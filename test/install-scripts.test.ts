import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const installPs1 = readFileSync('install.ps1', 'utf8')
const installSh = readFileSync('install.sh', 'utf8')

describe('standalone install scripts', () => {
  it('stages Windows downloads before replacing the live quantex.exe path', () => {
    expect(installPs1).toContain('GetTempPath')
    expect(installPs1).toContain('quantex-install-')
    expect(installPs1).toContain('Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpFile')
    expect(installPs1).toContain('Move-Item -LiteralPath $tmpFile -Destination $targetPath -Force')
    expect(installPs1).toContain('Copy-Item -LiteralPath $targetPath -Destination $aliasPath -Force')
    expect(installPs1).not.toMatch(/Invoke-WebRequest\s+-Uri\s+\$downloadUrl\s+-OutFile\s+\$targetPath\b/)
    expect(installPs1).toMatch(/Length\s+-le\s+0/)
  })

  it('keeps POSIX installs staged through a temp file before mv', () => {
    expect(installSh).toContain('mktemp -d')
    expect(installSh).toMatch(/curl -fsSL "\$download_url" -o "\$tmp_file"/)
    expect(installSh).toContain('mv "$tmp_file" "$INSTALL_DIR/quantex"')
  })
})
