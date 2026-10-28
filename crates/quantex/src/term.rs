//! Human-readable output: colour, width, tables, wrapped text.
//!
//! Human output is not part of the contract; it only has to say the same thing as the
//! structured result.

use std::io::{IsTerminal, Write};

use unicode_width::UnicodeWidthChar;

use crate::context::{ColorMode, Context};

const DEFAULT_WIDTH: usize = 80;
const MIN_WIDTH: usize = 8;

/// Whether ANSI colour should be written to stdout for this context.
pub fn color_enabled(mode: ColorMode) -> bool {
    match mode {
        ColorMode::Always => true,
        ColorMode::Never => false,
        ColorMode::Auto => {
            let env = |key: &str| std::env::var_os(key).is_some_and(|value| !value.is_empty());
            if env("NO_COLOR") {
                return false;
            }
            if env("FORCE_COLOR") || env("CI") || cfg!(windows) {
                return true;
            }
            std::io::stdout().is_terminal() && std::env::var("TERM").map_or(true, |term| term != "dumb")
        }
    }
}

fn terminal_width() -> usize {
    if let Some((terminal_size::Width(columns), _)) = terminal_size::terminal_size()
        && columns > 0
    {
        return usize::from(columns).max(MIN_WIDTH);
    }
    std::env::var("COLUMNS")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .filter(|&columns| columns > 0)
        .map_or(DEFAULT_WIDTH, |columns| columns.max(MIN_WIDTH))
}

/// Display width of text, ignoring ANSI escape sequences.
pub fn display_width(text: &str) -> usize {
    let mut width = 0;
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for next in chars.by_ref() {
                    if next.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
            continue;
        }
        width += c.width().unwrap_or(0);
    }
    width
}

/// Wraps text to `width` columns, breaking on whitespace and hard-breaking long words.
pub fn wrap(text: &str, width: usize) -> Vec<String> {
    let width = width.max(1);
    let mut lines = Vec::new();
    for paragraph in text.split('\n') {
        let mut line = String::new();
        let mut line_width = 0;
        for word in paragraph.split(' ') {
            let word_width = display_width(word);
            if line_width > 0 && line_width + 1 + word_width > width {
                lines.push(std::mem::take(&mut line));
                line_width = 0;
            }
            if word_width > width {
                for c in word.chars() {
                    let c_width = c.width().unwrap_or(0);
                    if line_width + c_width > width && line_width > 0 {
                        lines.push(std::mem::take(&mut line));
                        line_width = 0;
                    }
                    line.push(c);
                    line_width += c_width;
                }
                continue;
            }
            if line_width > 0 {
                line.push(' ');
                line_width += 1;
            }
            line.push_str(word);
            line_width += word_width;
        }
        lines.push(line);
    }
    lines
}

fn pad(text: &str, width: usize) -> String {
    let visible = display_width(text);
    if visible >= width {
        text.to_owned()
    } else {
        format!("{text}{}", " ".repeat(width - visible))
    }
}

/// A table column.
pub struct Column<'a> {
    pub header: &'a str,
    pub wrap: bool,
    pub min_width: usize,
    pub max_width: Option<usize>,
}

impl<'a> Column<'a> {
    pub fn new(header: &'a str) -> Self {
        Self {
            header,
            wrap: false,
            min_width: 4,
            max_width: None,
        }
    }

    pub fn wrapping(mut self) -> Self {
        self.wrap = true;
        self
    }

    pub fn max(mut self, width: usize) -> Self {
        self.max_width = Some(width);
        self
    }
}

/// Writes human output for one invocation.
pub struct Human {
    color: bool,
    pub width: usize,
}

impl Human {
    pub fn new(ctx: &Context) -> Self {
        Self {
            color: color_enabled(ctx.color_mode),
            width: terminal_width(),
        }
    }

    fn style(&self, code: &str, close: &str, text: &str) -> String {
        if self.color {
            format!("\u{1b}[{code}m{text}\u{1b}[{close}m")
        } else {
            text.to_owned()
        }
    }

    pub fn bold(&self, text: &str) -> String {
        self.style("1", "22", text)
    }
    pub fn dim(&self, text: &str) -> String {
        self.style("2", "22", text)
    }
    pub fn red(&self, text: &str) -> String {
        self.style("31", "39", text)
    }
    pub fn green(&self, text: &str) -> String {
        self.style("32", "39", text)
    }
    pub fn yellow(&self, text: &str) -> String {
        self.style("33", "39", text)
    }
    pub fn cyan(&self, text: &str) -> String {
        self.style("36", "39", text)
    }

    /// Writes one line to stdout.
    pub fn line(&mut self, text: &str) {
        let stdout = std::io::stdout();
        let mut lock = stdout.lock();
        let _ = writeln!(lock, "{text}");
    }

    pub fn blank(&mut self) {
        self.line("");
    }

    /// Writes an error line to stderr.
    pub fn error_line(&mut self, text: &str) {
        let red = self.red(text);
        eprintln!("{red}");
    }

    /// Writes a warning line to stderr.
    pub fn warn_line(&mut self, text: &str) {
        let yellow = self.yellow(text);
        eprintln!("{yellow}");
    }

    /// A heading with a blank line on either side.
    pub fn heading(&mut self, text: &str) {
        let bold = self.bold(text);
        self.blank();
        self.line(&bold);
        self.blank();
    }

    /// Writes wrapped text with an indent.
    pub fn paragraph(&mut self, text: &str, indent: &str) {
        let width = self.width.saturating_sub(display_width(indent)).max(1);
        for line in wrap(text, width) {
            self.line(format!("{indent}{line}").trim_end());
        }
    }

    /// Writes `Label:  value` pairs with aligned values.
    pub fn fields(&mut self, fields: &[(&str, String)]) {
        let label_width = fields
            .iter()
            .map(|(label, _)| display_width(label) + 1)
            .max()
            .unwrap_or(0);
        let indent = 2;
        let value_width = self.width.saturating_sub(indent + label_width + 2).max(16);
        for (label, value) in fields {
            let label_text = pad(&format!("{label}:"), label_width);
            let lines = wrap(value, value_width);
            for (index, line) in lines.iter().enumerate() {
                let prefix = if index == 0 {
                    label_text.clone()
                } else {
                    " ".repeat(label_width)
                };
                self.line(format!("{}{}  {}", " ".repeat(indent), prefix, line).trim_end());
            }
        }
    }

    /// Writes a table with a header row.
    pub fn table(&mut self, columns: &[Column<'_>], rows: &[Vec<String>]) {
        let indent = 2;
        let gap = 2;
        let available = self.width.saturating_sub(indent).max(1);
        let mut widths: Vec<usize> = columns
            .iter()
            .enumerate()
            .map(|(index, column)| {
                let natural = rows
                    .iter()
                    .map(|row| row.get(index).map_or(0, |cell| display_width(cell)))
                    .chain(std::iter::once(display_width(column.header)))
                    .max()
                    .unwrap_or(0);
                column.max_width.map_or(natural, |max| natural.min(max)).max(1)
            })
            .collect();
        let total = |widths: &[usize]| widths.iter().sum::<usize>() + gap * widths.len().saturating_sub(1);
        // Shrink wrapping columns, widest first, until the table fits.
        while total(&widths) > available {
            let candidate = columns
                .iter()
                .enumerate()
                .filter(|(index, column)| column.wrap && widths[*index] > column.min_width)
                .max_by_key(|(index, _)| widths[*index]);
            match candidate {
                Some((index, _)) => widths[index] -= 1,
                None => break,
            }
        }
        let prefix = " ".repeat(indent);
        let gap_text = " ".repeat(gap);
        let header = columns
            .iter()
            .zip(&widths)
            .map(|(column, &width)| pad(&self.bold(column.header), width))
            .collect::<Vec<_>>()
            .join(&gap_text);
        self.line(format!("{prefix}{header}").trim_end());
        for row in rows {
            let cells: Vec<Vec<String>> = columns
                .iter()
                .zip(&widths)
                .enumerate()
                .map(|(index, (column, &width))| {
                    let value = row.get(index).cloned().unwrap_or_default();
                    if column.wrap { wrap(&value, width) } else { vec![value] }
                })
                .collect();
            let height = cells.iter().map(Vec::len).max().unwrap_or(1);
            for line_index in 0..height {
                let line = cells
                    .iter()
                    .zip(&widths)
                    .map(|(lines, &width)| pad(lines.get(line_index).map_or("", String::as_str), width))
                    .collect::<Vec<_>>()
                    .join(&gap_text);
                self.line(format!("{prefix}{line}").trim_end());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn width_ignores_ansi_and_counts_wide_characters() {
        assert_eq!(display_width("\u{1b}[1mabc\u{1b}[22m"), 3);
        assert_eq!(display_width("统一"), 4);
    }

    #[test]
    fn wrap_breaks_on_spaces_and_long_words() {
        assert_eq!(wrap("one two three", 7), vec!["one two", "three"]);
        assert_eq!(wrap("abcdefghij", 4), vec!["abcd", "efgh", "ij"]);
        assert_eq!(wrap("", 4), vec![""]);
    }
}
