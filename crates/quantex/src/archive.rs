//! Release archives: one standalone binary in a `.tar.gz` (macOS, Linux) or `.zip`
//! (Windows). The layout matches what v1.13.6 writes and accepts, so a v1 binary can
//! upgrade to a release built here: exactly one regular-file entry named after the
//! binary, and no zip data descriptors.

use std::io::{Read, Write};

use flate2::Compression;
use flate2::read::{DeflateDecoder, GzDecoder};
use flate2::write::{DeflateEncoder, GzEncoder};

const ZIP_LOCAL_FILE: u32 = 0x0403_4b50;
const ZIP_CENTRAL_DIRECTORY: u32 = 0x0201_4b50;
const ZIP_END_OF_CENTRAL_DIRECTORY: u32 = 0x0605_4b50;

/// The binaries every release ships.
pub const RELEASE_BINARY_NAMES: [&str; 5] = [
    "quantex-darwin-arm64",
    "quantex-darwin-x64",
    "quantex-linux-arm64",
    "quantex-linux-x64",
    "quantex-windows-x64.exe",
];

/// `(platform, arch)` in Node's naming, for `quantex-<os>-<arch>[.exe]`.
pub fn binary_target(binary_name: &str) -> Option<(&'static str, &'static str)> {
    let rest = binary_name.strip_prefix("quantex-")?;
    let (os, arch) = rest.split_once('-')?;
    let arch = arch.strip_suffix(".exe").unwrap_or(arch);
    let exe = binary_name.ends_with(".exe");
    let platform = match os {
        "darwin" if !exe => "darwin",
        "linux" if !exe => "linux",
        "windows" => "win32",
        _ => return None,
    };
    let arch = match arch {
        "arm64" => "arm64",
        "x64" => "x64",
        _ => return None,
    };
    Some((platform, arch))
}

fn is_zip(binary_name: &str) -> bool {
    binary_target(binary_name).is_some_and(|(platform, _)| platform == "win32")
}

/// `quantex-darwin-arm64` → `quantex-darwin-arm64.tar.gz`.
pub fn archive_name(binary_name: &str) -> String {
    let format = if is_zip(binary_name) { "zip" } else { "tar.gz" };
    format!("{binary_name}.{format}")
}

/// The binary an archive name carries, when it is a valid release archive name.
pub fn binary_name(archive_name: &str) -> Option<&str> {
    let (binary, zip) = if let Some(binary) = archive_name.strip_suffix(".zip") {
        (binary, true)
    } else {
        (archive_name.strip_suffix(".tar.gz")?, false)
    };
    (binary_target(binary).is_some() && is_zip(binary) == zip).then_some(binary)
}

/// Packs `binary` as the single entry of its release archive.
pub fn create(binary_name: &str, binary: &[u8]) -> Result<Vec<u8>, String> {
    if binary_target(binary_name).is_none() {
        return Err(format!("Invalid release binary name: {binary_name}."));
    }
    if is_zip(binary_name) {
        create_zip(binary_name, binary)
    } else {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
        encoder
            .write_all(&create_tar(binary_name, binary)?)
            .map_err(|error| error.to_string())?;
        encoder.finish().map_err(|error| error.to_string())
    }
}

/// Unpacks the single expected binary from a release archive.
pub fn extract(archive: &[u8], binary_name: &str) -> Result<Vec<u8>, String> {
    if binary_target(binary_name).is_none() {
        return Err(format!("Invalid expected release binary name: {binary_name}."));
    }
    if is_zip(binary_name) {
        extract_zip(archive, binary_name)
    } else {
        extract_tar_gz(archive, binary_name)
    }
}

// ---------------------------------------------------------------------------
// tar

fn tar_field(header: &mut [u8], offset: usize, length: usize, value: &str) -> Result<(), String> {
    let bytes = value.as_bytes();
    if bytes.len() > length {
        return Err("Release archive contains a tar field that is too long.".into());
    }
    header[offset..offset + bytes.len()].copy_from_slice(bytes);
    Ok(())
}

fn create_tar(name: &str, binary: &[u8]) -> Result<Vec<u8>, String> {
    let mut header = [0u8; 512];
    tar_field(&mut header, 0, 100, name)?;
    tar_field(&mut header, 100, 8, "0000755\0")?;
    tar_field(&mut header, 108, 8, "0000000\0")?;
    tar_field(&mut header, 116, 8, "0000000\0")?;
    tar_field(&mut header, 124, 12, &format!("{:011o}\0", binary.len()))?;
    tar_field(&mut header, 136, 12, "00000000000\0")?;
    header[156] = b'0';
    tar_field(&mut header, 257, 8, "ustar\0")?;
    tar_field(&mut header, 263, 2, "00")?;
    header[148..156].fill(b' ');
    let checksum: u32 = header.iter().map(|&byte| u32::from(byte)).sum();
    tar_field(&mut header, 148, 8, &format!("{checksum:06o}\0 "))?;

    let padding = (512 - binary.len() % 512) % 512;
    let mut tar = Vec::with_capacity(512 + binary.len() + padding + 1024);
    tar.extend_from_slice(&header);
    tar.extend_from_slice(binary);
    tar.resize(tar.len() + padding + 1024, 0);
    Ok(tar)
}

fn tar_string(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&byte| byte == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).into_owned()
}

fn extract_tar_gz(archive: &[u8], expected: &str) -> Result<Vec<u8>, String> {
    let mut contents = Vec::new();
    GzDecoder::new(archive)
        .read_to_end(&mut contents)
        .map_err(|_| "Release archive is not a valid gzip stream.".to_owned())?;
    let mut offset = 0;
    let mut extracted: Option<Vec<u8>> = None;
    while offset + 512 <= contents.len() {
        let header = &contents[offset..offset + 512];
        if header.iter().all(|&byte| byte == 0) {
            break;
        }
        let name = tar_string(&header[0..100]);
        let prefix = tar_string(&header[345..500]);
        let entry = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };
        let size_text = tar_string(&header[124..136]);
        let size_text = size_text.trim();
        if size_text.is_empty() || !size_text.bytes().all(|byte| (b'0'..=b'7').contains(&byte)) {
            return Err("Release archive contains an invalid tar size.".into());
        }
        let size = usize::from_str_radix(size_text, 8)
            .map_err(|_| "Release archive contains an unsafe tar size.".to_owned())?;
        let body_start = offset + 512;
        let body_end = body_start
            .checked_add(size)
            .ok_or_else(|| "Release archive contains an unsafe tar size.".to_owned())?;
        if name.is_empty() || body_end > contents.len() {
            return Err("Release archive contains an invalid tar entry.".into());
        }
        if header[156] != 0 && header[156] != b'0' {
            return Err("Release archive must contain only a regular file.".into());
        }
        if entry != expected || extracted.is_some() {
            return Err(format!("Release archive must contain exactly {expected}."));
        }
        extracted = Some(contents[body_start..body_end].to_vec());
        offset = body_start + size.div_ceil(512) * 512;
    }
    extracted.ok_or_else(|| format!("Release archive does not contain {expected}."))
}

// ---------------------------------------------------------------------------
// zip

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffffu32;
    for &byte in bytes {
        crc ^= u32::from(byte);
        for _ in 0..8 {
            crc = if crc & 1 == 0 {
                crc >> 1
            } else {
                (crc >> 1) ^ 0xedb8_8320
            };
        }
    }
    crc ^ 0xffff_ffff
}

fn create_zip(name: &str, binary: &[u8]) -> Result<Vec<u8>, String> {
    let name = name.as_bytes();
    let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
    encoder.write_all(binary).map_err(|error| error.to_string())?;
    let compressed = encoder.finish().map_err(|error| error.to_string())?;
    let (method, payload): (u16, &[u8]) = if compressed.len() < binary.len() {
        (8, &compressed)
    } else {
        (0, binary)
    };
    let size = |len: usize| u32::try_from(len).map_err(|_| "Release archive is too large for zip.".to_owned());
    let (crc, compressed_size, size_value) = (crc32(binary), size(payload.len())?, size(binary.len())?);
    let name_length = u16::try_from(name.len()).map_err(|_| "Release archive entry name is too long.".to_owned())?;

    let mut zip = Vec::new();
    let local = |zip: &mut Vec<u8>| {
        zip.extend_from_slice(&ZIP_LOCAL_FILE.to_le_bytes());
        zip.extend_from_slice(&20u16.to_le_bytes()); // version needed
        zip.extend_from_slice(&0u16.to_le_bytes()); // flags
        zip.extend_from_slice(&method.to_le_bytes());
        zip.extend_from_slice(&[0; 4]); // time, date
        zip.extend_from_slice(&crc.to_le_bytes());
        zip.extend_from_slice(&compressed_size.to_le_bytes());
        zip.extend_from_slice(&size_value.to_le_bytes());
        zip.extend_from_slice(&name_length.to_le_bytes());
        zip.extend_from_slice(&0u16.to_le_bytes()); // extra length
        zip.extend_from_slice(name);
    };
    local(&mut zip);
    zip.extend_from_slice(payload);
    let central_offset = size(zip.len())?;

    zip.extend_from_slice(&ZIP_CENTRAL_DIRECTORY.to_le_bytes());
    zip.extend_from_slice(&20u16.to_le_bytes()); // version made by
    zip.extend_from_slice(&20u16.to_le_bytes()); // version needed
    zip.extend_from_slice(&0u16.to_le_bytes()); // flags
    zip.extend_from_slice(&method.to_le_bytes());
    zip.extend_from_slice(&[0; 4]); // time, date
    zip.extend_from_slice(&crc.to_le_bytes());
    zip.extend_from_slice(&compressed_size.to_le_bytes());
    zip.extend_from_slice(&size_value.to_le_bytes());
    zip.extend_from_slice(&name_length.to_le_bytes());
    zip.extend_from_slice(&[0; 12]); // extra, comment, disk, internal and external attributes
    zip.extend_from_slice(&0u32.to_le_bytes()); // local header offset
    zip.extend_from_slice(name);
    let central_size = size(zip.len())? - central_offset;

    zip.extend_from_slice(&ZIP_END_OF_CENTRAL_DIRECTORY.to_le_bytes());
    zip.extend_from_slice(&[0; 4]); // disk numbers
    zip.extend_from_slice(&1u16.to_le_bytes());
    zip.extend_from_slice(&1u16.to_le_bytes());
    zip.extend_from_slice(&central_size.to_le_bytes());
    zip.extend_from_slice(&central_offset.to_le_bytes());
    zip.extend_from_slice(&0u16.to_le_bytes()); // comment length
    Ok(zip)
}

struct ZipReader<'a> {
    bytes: &'a [u8],
}

impl ZipReader<'_> {
    fn range(&self, offset: usize, length: usize) -> Result<&[u8], String> {
        offset
            .checked_add(length)
            .and_then(|end| self.bytes.get(offset..end))
            .ok_or_else(|| "Release archive contains an invalid zip entry.".to_owned())
    }

    fn u16(&self, offset: usize) -> Result<usize, String> {
        let bytes = self.range(offset, 2)?;
        Ok(usize::from(u16::from_le_bytes([bytes[0], bytes[1]])))
    }

    fn u32(&self, offset: usize) -> Result<u32, String> {
        let bytes = self.range(offset, 4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }
}

fn extract_zip(archive: &[u8], expected: &str) -> Result<Vec<u8>, String> {
    let zip = ZipReader { bytes: archive };
    let mut offset = 0;
    let mut extracted: Option<Vec<u8>> = None;
    while offset + 4 <= archive.len() {
        match zip.u32(offset)? {
            ZIP_LOCAL_FILE => {
                zip.range(offset, 30)?;
                let flags = zip.u16(offset + 6)?;
                let method = zip.u16(offset + 8)?;
                let crc = zip.u32(offset + 14)?;
                let compressed_size = zip.u32(offset + 18)? as usize;
                let size = zip.u32(offset + 22)? as usize;
                let name_length = zip.u16(offset + 26)?;
                let extra_length = zip.u16(offset + 28)?;
                let name_start = offset + 30;
                let data_start = name_start + name_length + extra_length;
                zip.range(offset, 30 + name_length + extra_length + compressed_size)?;
                if flags & 0x1 != 0 || flags & 0x8 != 0 {
                    return Err("Release archive contains an unsupported zip entry.".into());
                }
                let name = String::from_utf8_lossy(zip.range(name_start, name_length)?);
                if name != expected || extracted.is_some() {
                    return Err(format!("Release archive must contain exactly {expected}."));
                }
                let data = zip.range(data_start, compressed_size)?;
                let invalid = || "Release archive contains an invalid zip entry.".to_owned();
                let binary = match method {
                    0 => data.to_vec(),
                    8 => {
                        let mut out = Vec::with_capacity(size);
                        DeflateDecoder::new(data).read_to_end(&mut out).map_err(|_| invalid())?;
                        out
                    }
                    _ => return Err(invalid()),
                };
                if binary.len() != size || crc32(&binary) != crc {
                    return Err(invalid());
                }
                extracted = Some(binary);
                offset = data_start + compressed_size;
            }
            ZIP_CENTRAL_DIRECTORY => {
                let Some(binary) = extracted else {
                    return Err(format!("Release archive does not contain {expected}."));
                };
                validate_central_directory(&zip, offset, expected)?;
                return Ok(binary);
            }
            _ => return Err("Release archive is not a valid zip file.".into()),
        }
    }
    Err(format!("Release archive does not contain {expected}."))
}

fn validate_central_directory(zip: &ZipReader<'_>, mut offset: usize, expected: &str) -> Result<(), String> {
    let mut entries = 0;
    while offset + 4 <= zip.bytes.len() && zip.u32(offset)? == ZIP_CENTRAL_DIRECTORY {
        zip.range(offset, 46)?;
        let name_length = zip.u16(offset + 28)?;
        let extra_length = zip.u16(offset + 30)?;
        let comment_length = zip.u16(offset + 32)?;
        zip.range(offset, 46 + name_length + extra_length + comment_length)?;
        let name = String::from_utf8_lossy(zip.range(offset + 46, name_length)?);
        if name != expected || entries > 0 {
            return Err(format!("Release archive must contain exactly {expected}."));
        }
        entries += 1;
        offset += 46 + name_length + extra_length + comment_length;
    }
    zip.range(offset, 22)?;
    if zip.u32(offset)? != ZIP_END_OF_CENTRAL_DIRECTORY || entries != 1 || zip.u16(offset + 10)? != entries {
        return Err("Release archive is not a valid zip file.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn archive_names_follow_the_platform() {
        assert_eq!(archive_name("quantex-linux-x64"), "quantex-linux-x64.tar.gz");
        assert_eq!(archive_name("quantex-windows-x64.exe"), "quantex-windows-x64.exe.zip");
        assert_eq!(binary_name("quantex-darwin-arm64.tar.gz"), Some("quantex-darwin-arm64"));
        assert_eq!(
            binary_name("quantex-windows-x64.exe.zip"),
            Some("quantex-windows-x64.exe")
        );
        assert_eq!(binary_name("quantex-windows-x64.exe.tar.gz"), None);
        assert_eq!(binary_name("quantex-linux-x64.zip"), None);
        assert_eq!(binary_target("quantex-windows-x64.exe"), Some(("win32", "x64")));
    }

    #[test]
    fn archives_round_trip() {
        let binary: Vec<u8> = (0..70_000u32).map(|index| (index % 251) as u8).collect();
        for name in RELEASE_BINARY_NAMES {
            let archive = create(name, &binary).unwrap();
            assert_eq!(extract(&archive, name).unwrap(), binary, "{name}");
        }
    }

    #[test]
    fn extraction_requires_the_expected_entry() {
        let archive = create("quantex-linux-x64", b"bin").unwrap();
        assert!(extract(&archive, "quantex-linux-arm64").is_err());
        let zip = create("quantex-windows-x64.exe", b"bin").unwrap();
        assert!(extract(&zip[..zip.len() - 4], "quantex-windows-x64.exe").is_err());
    }

    #[test]
    fn crc32_matches_the_reference_value() {
        assert_eq!(crc32(b"123456789"), 0xcbf4_3926);
    }
}
