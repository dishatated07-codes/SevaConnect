const escapeCsvCell = (value) => {
    let text = value == null ? "" : String(value);
    // Prefix a text cell with an apostrophe if a spreadsheet could parse it as a formula.
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (headers, rows) => [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(","))
].join("\r\n");

module.exports = { escapeCsvCell, toCsv };
