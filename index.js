#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const url = __importStar(require("url"));
const googleapis_1 = require("googleapis");
const csv_parse_1 = __importDefault(require("csv-parse"));
const csv_stringify_1 = __importDefault(require("csv-stringify"));
const CLI_NAME = 'gsheetcli';
function parseSpreadSheetURL(urlStr) {
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
    const spreadSheetId = component.path.split('/')[3];
    if (!spreadSheetId) {
        throw new Error(`${CLI_NAME}: could not find spreadsheet ID from the path of URL ${urlStr}`);
    }
    if (!component.hash) {
        throw new Error(`${CLI_NAME}: could not find the hash of URL ${urlStr}`);
    }
    const parsedHash = url.parse(`?${component.hash.slice(1)}`, true).query;
    const sheetId = parseInt(parsedHash.gid, 10);
    const range = parsedHash.range;
    return {
        spreadSheetId,
        sheetId,
        range,
    };
}
function getService() {
    return __awaiter(this, void 0, void 0, function* () {
        // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
        // environment variables.
        const auth = yield googleapis_1.google.auth.getClient({
            // Scopes can be specified either as an array or as a single, space-delimited string.
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const service = googleapis_1.google.sheets({ version: 'v4', auth });
        return service;
    });
}
function get() {
    return __awaiter(this, void 0, void 0, function* () {
        const stringifier = csv_stringify_1.default();
        stringifier.on('readable', () => {
            const row = stringifier.read();
            process.stdout.write(row.toString());
        });
        const service = yield getService();
        const range = parseSpreadSheetURL(process.argv[3]);
        const spreadsheet = yield service.spreadsheets.get({
            'spreadsheetId': range.spreadSheetId,
            'includeGridData': false,
        });
        if (!spreadsheet.data.sheets) {
            return;
        }
        const sheetProperty = spreadsheet.data.sheets.find(sheet => sheet.properties ? sheet.properties.sheetId === range.sheetId : false);
        if (!sheetProperty || !sheetProperty.properties) {
            return;
        }
        const sheetData = yield service.spreadsheets.values.get({
            'majorDimension': 'ROWS',
            'spreadsheetId': range.spreadSheetId,
            'range': sheetProperty.properties.title,
        });
        for (const row of sheetData.data.values || []) {
            stringifier.write(row);
        }
    });
}
function update() {
    return __awaiter(this, void 0, void 0, function* () {
        const rows = [];
        var parser = csv_parse_1.default({ 'relax_column_count': true });
        parser.on('readable', () => {
            let row;
            while (row = parser.read()) {
                rows.push(row);
            }
        });
        parser.on('end', () => __awaiter(this, void 0, void 0, function* () {
            const service = yield getService();
            const range = parseSpreadSheetURL(process.argv[3]);
            const spreadsheet = yield service.spreadsheets.get({
                'spreadsheetId': range.spreadSheetId,
                'includeGridData': false,
            });
            if (!spreadsheet.data.sheets) {
                return;
            }
            const sheetProperty = spreadsheet.data.sheets.find(sheet => sheet.properties ? sheet.properties.sheetId === range.sheetId : false);
            if (!sheetProperty || !sheetProperty.properties) {
                return;
            }
            const resp = yield service.spreadsheets.values.update({
                'range': sheetProperty.properties.title,
                'spreadsheetId': range.spreadSheetId,
                'valueInputOption': 'RAW',
                'requestBody': {
                    'majorDimension': 'ROWS',
                    'values': rows,
                }
            });
            console.log(`${resp.data.updatedCells} cells updated.`);
        }));
        parser.on('error', (err) => {
            console.error(err.message);
        });
        // collecting
        process.stdin.on('readable', () => {
            let chunk;
            while (chunk = process.stdin.read()) {
                parser.write(chunk);
            }
        });
        process.stdin.on('end', () => {
            parser.end();
        });
    });
}
function append() {
    return __awaiter(this, void 0, void 0, function* () {
        console.error('not implemented :)');
    });
}
function help() {
    return __awaiter(this, void 0, void 0, function* () {
        // console.log(`usage: ${CLI_NAME} get | update | append`);
        console.log(`usage: ${CLI_NAME} get | update | help`);
        console.log(``);
        console.log(`commands:`);
        console.log(`    get SHEET_URL       fetch a sheet by SHEET_URL and print it as CSV`);
        console.log(`    update SHEET_URL    update SHEET_URL with the CSV read from stdin`);
        console.log(`    help                show this message`);
        // console.log(`    append SHEET_ID:  append CSV read from stdin to SHEET_URL`);
    });
}
function error(subcommand) {
    return __awaiter(this, void 0, void 0, function* () {
        throw new Error(`${CLI_NAME}: '${subcommand}' is not found. See '${CLI_NAME} help'.`);
    });
}
const subcommand = process.argv[2];
if (subcommand === 'get') {
    get().catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}
else if (subcommand === 'update') {
    update().catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}
else if (subcommand === 'append') {
    append().catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}
else if (subcommand === 'help' || subcommand === undefined) {
    help().catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}
else {
    error(subcommand).catch(err => {
        console.error(err.message);
        process.exit(1);
    });
}
