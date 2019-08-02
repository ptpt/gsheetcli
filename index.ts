#!/usr/bin/env node
import * as url from "url";

import parse from "csv-parse";
import stringify from "csv-stringify";
import {google} from "googleapis";

const CLI_NAME = "gsheetcli";

function parseSpreadSheetURL(urlStr: string) {
    // Url {
    //     protocol: 'https:',
    //     slashes: true,
    //     auth: null,
    //     host: 'docs.google.com',
    //     port: null,
    //     hostname: 'docs.google.com',
    //     hash: '#gid=1793890757&range=A1:B1',
    //     search: null,
    //     query: {},
    //     pathname:
    //     '/spreadsheets/d/XXX/edit',
    //     path:
    //     '/spreadsheets/d/XXX/edit',
    //     href:
    //     'https://docs.google.com/spreadsheets/d/XXX/edit#gid=1793890757&range=A1:B1' }
    const component = url.parse(urlStr, true);
    if (!component.path) {
        throw new Error(`${CLI_NAME}: could not find spreadsheet ID from the path of URL ${urlStr}`);
    }
    const spreadSheetId = component.path.split("/")[3];
    if (!spreadSheetId) {
        throw new Error(`${CLI_NAME}: could not find spreadsheet ID from the path of URL ${urlStr}`);
    }
    if (!component.hash) {
        throw new Error(`${CLI_NAME}: could not find the hash of URL ${urlStr}`);
    }
    const parsedHash = url.parse(`?${component.hash.slice(1)}`, true).query as {gid: string, range: string};
    const sheetId = parseInt(parsedHash.gid, 10);
    const range = parsedHash.range;
    return {
        spreadSheetId,
        sheetId,
        range,
    };
}

async function getService() {
    // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
    // environment variables.
    const auth = await google.auth.getClient({
        // Scopes can be specified either as an array or as a single, space-delimited string.
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const service = google.sheets({version: "v4", auth});
    return service;
}

async function get() {
    process.stdout.on("close", () => {
        process.exit(0);
    });

    process.stdout.on("end", () => {
        process.exit(0);
    });

    const service = await getService();
    const range = parseSpreadSheetURL(process.argv[3]);
    const spreadsheet = await service.spreadsheets.get({
        spreadsheetId: range.spreadSheetId,
        includeGridData: false,
    });
    if (!spreadsheet.data.sheets) {
        return;
    }
    // getting sheet title for constructing range
    const sheetProperty = spreadsheet.data.sheets.find((sheet) => sheet.properties ? sheet.properties.sheetId === range.sheetId : false);
    if (!sheetProperty || !sheetProperty.properties) {
        return;
    }
    const finalRange = range.range ? `${sheetProperty.properties.title}!${range.range}` : sheetProperty.properties.title;
    const sheetData = await service.spreadsheets.values.get({
        majorDimension: "ROWS",
        spreadsheetId: range.spreadSheetId,
        range: finalRange,
    });
    stringify(sheetData.data.values || [], (err, output) => {
        if (err) {
            throw err;
        }
        if (output !== undefined) {
            process.stdout.write(output);
            process.stdout.end();
        }
    });
}

async function update() {
    const rows: string[][] = [];

    let parser = parse({relax_column_count: true});

    parser.on("readable", () => {
        let row;
        while (row = parser.read()) {
            rows.push(row);
        }
    });

    parser.on("end", async () => {
        const service = await getService();
        const range = parseSpreadSheetURL(process.argv[3]);
        const spreadsheet = await service.spreadsheets.get({
            spreadsheetId: range.spreadSheetId,
            includeGridData: false,
        });
        if (!spreadsheet.data.sheets) {
            return;
        }
        // getting sheet title for constructing range
        const sheetProperty = spreadsheet.data.sheets.find(
            (sheet) => sheet.properties ? sheet.properties.sheetId === range.sheetId : false,
        );
        if (!sheetProperty || !sheetProperty.properties) {
            return;
        }
        const finalRange = range.range ? `${sheetProperty.properties.title}!${range.range}` : sheetProperty.properties.title;
        const resp = await service.spreadsheets.values.update({
            range: finalRange,
            spreadsheetId: range.spreadSheetId,
            valueInputOption: "RAW",
            requestBody: {
                majorDimension: "ROWS",
                values: rows,
            },
        });
        console.log(`${resp.data.updatedCells} cells updated.`);
    });

    parser.on("error", (err: Error) => {
        console.error(err.message);
    });

    // collecting
    process.stdin.on("readable", () => {
        let chunk;
        while (chunk = process.stdin.read()) {
            parser.write(chunk);
        }
    });

    process.stdin.on("end", () => {
        parser.end();
    });
}

async function append() {
    console.error("not implemented :)");
}

async function help() {
    // console.log(`usage: ${CLI_NAME} get | update | append`);
    console.log(`usage: ${CLI_NAME} get | update | help`);
    console.log(``);
    console.log(`commands:`);
    console.log(`    get SHEET_URL       fetch a sheet by SHEET_URL and print it as CSV`);
    console.log(`    update SHEET_URL    update SHEET_URL with the CSV read from stdin`);
    console.log(`    help                show this message`);
    // console.log(`    append SHEET_ID:  append CSV read from stdin to SHEET_URL`);
}

async function error(subcommand: string) {
    throw new Error(`${CLI_NAME}: '${subcommand}' is not found. See '${CLI_NAME} help'.`);
}

type SUBCOMMAND = "get" | "update" | "append" | "help";

const subcommand = process.argv[2] as SUBCOMMAND;

if (subcommand === "get") {
    get().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
} else if (subcommand === "update") {
    update().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
} else if (subcommand === "append") {
    append().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
} else if (subcommand === "help" || subcommand === undefined) {
    help().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
} else {
    error(subcommand).catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}
