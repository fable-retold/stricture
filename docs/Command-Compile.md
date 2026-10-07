# Command: Compile

Parse a MicroDDL file into intermediate JSON model files.

**Source:** `Stricture-Compile.js`

## Usage

```bash
node Stricture.js -i Model.mddl -c Compile -f ./model/ -o MeadowModel
```

## Input

A MicroDDL (`.mddl` or `.ddl`) text file. See
[MicroDDL-Syntax.md](MicroDDL-Syntax.md) for the full language reference.

## Output Files

Three JSON files are written to the output directory:

### 1. `{OutputFileName}.json` (Basic Model)

Contains only the table definitions:

```json
{
    "Tables": {
        "User": {
            "TableName": "User",
            "Domain": "Default",
            "Columns": [
                { "Column": "IDUser", "DataType": "ID" },
                { "Column": "UserName", "DataType": "String", "Size": "64" }
            ],
            "Description": ""
        }
    }
}
```

### 2. `{OutputFileName}-Extended.json` (Extended Model)

The full Stricture model including tables, authorization rules, endpoint
definitions, PICT UI configuration and inline Meadow schemas:

```json
{
    "Tables": { ... },
    "TablesSequence": ["User", "Contact"],
    "Authorization": { ... },
    "Endpoints": { ... },
    "Pict": { ... }
}
```

Each table in the extended model also includes a `MeadowSchema` property
with the auto-generated Meadow schema (Scope, DefaultIdentifier, Schema
array, DefaultObject, JsonSchema).

### 3. `{OutputFileName}-PICT.json` (PICT Definitions)

The PICT UI configuration extracted as a standalone file, containing
Create, List, Record, Update and Delete view definitions for any tables
that have PICT stanzas.

## How It Works

1. Reads the MicroDDL file line-by-line
2. Maintains parser state (`CurrentScope`, `StanzaType`, `CurrentDomain`)
3. Blank lines reset the parser state, closing the current stanza; so does
   the end of each file
4. Processes `[Include ...]` directives recursively after the main file
5. After parsing, auto-generates inline Meadow schemas for each table
6. Writes all three JSON output files

## Notes

- The `Full` command calls `Compile` as its first step automatically.
- Most other generator commands expect JSON model files as input, not
  MicroDDL. Run `Compile` first, then point subsequent commands at the
  extended model JSON.
- Include files are resolved relative to the directory containing the
  current file being parsed.
