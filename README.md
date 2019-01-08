 
# gsheetcli

`gsheetcli` is a simple command line tool that manages Google Sheets.

## Installation

```
npm install -g gsheetcli
```

## Usage

```
usage: gsheetcli get | update | help

commands:
    get SHEET_URL       fetch a sheet by SHEET_URL and print it as CSV
    update SHEET_URL    update SHEET_URL with the CSV read from stdin
    help                show this message
```

## Development

Compile and watch:
```
npx tsc -w
```

## License

MIT. See LICENSE.
