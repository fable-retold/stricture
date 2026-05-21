# MicroDDL Syntax Reference

MicroDDL is a line-oriented, Markdown-inspired schema definition language.
Each line is parsed independently based on its first character. Blank lines
reset the parser state and close the current stanza.

## Table Definition

Begin a table with `!` followed by the table name. All column lines that
follow belong to this table until a blank line is encountered.

```
!User
@IDUser
$UserName
$Email 60
&CreateDate
#CreatingIDUser -> IDUser
```

## Column Type Symbols

| Symbol | Type         | MySQL Mapping                    | Default Size | Notes                        |
|--------|-------------|----------------------------------|-------------|------------------------------|
| `@`    | ID           | INT UNSIGNED NOT NULL AUTO_INCREMENT | --       | Primary key                  |
| `%`    | GUID         | CHAR(n)                          | 36          | Size overridable             |
| `~`    | ForeignKey   | INT UNSIGNED NOT NULL DEFAULT '0'| --          | Foreign key reference        |
| `#`    | Numeric      | INT NOT NULL DEFAULT '0'         | int         | Integer; size overridable    |
| `.`    | Decimal      | DECIMAL(p,s)                     | 10,3        | Precision overridable        |
| `$`    | String       | CHAR(n) NOT NULL DEFAULT ''      | 64          | Size overridable             |
| `*`    | Text         | TEXT                             | --          | Unbounded text               |
| `&`    | DateTime     | DATETIME                         | --          | Date/time value              |
| `^`    | Boolean      | TINYINT NOT NULL DEFAULT '0'     | --          | Boolean flag                 |
| `{`    | JSON         | LONGTEXT                         | --          | JSON object (see below)      |

### JSON Column Syntax

The `{` symbol defines columns that store structured JSON data. In MySQL the column type is `LONGTEXT` (up to 4GB); other databases use `TEXT` (unlimited in PostgreSQL/SQLite) or `NVARCHAR(MAX)` (MSSQL).

**JSON** -- the SQL column and object property share the same name:

```
{Metadata
```

**JSON Proxy** -- the SQL column differs from the object property. The second token is the storage column name:

```
{Preferences PreferencesJSON
```

This stores the data in a SQL column called `PreferencesJSON` but exposes it as `Preferences` on the JavaScript object. The storage column is hidden from API consumers.

The proxy form is detected when a second token exists that is not a join arrow (`->`) and is not purely numeric (which would be a size override).

## Size Overrides

For types that accept a size, add the size after a space:

```
$UserName 128        # CHAR(128)
%GUIDUser 48         # CHAR(48)
#SortOrder 11        # INT (size hint)
.Amount 12,2         # DECIMAL(12,2)
```

## Joins (Foreign Key References)

Use `->` at the end of a column line to declare a foreign key relationship:

```
#IDUser -> IDUser
```

This indicates the column joins to whatever table owns `IDUser` as its
primary key. The compiler resolves this through an index of primary keys.

## Table-Level Joins

Use `=>` to declare a table-level join relationship:

```
$SomeColumn => OtherTable
```

## Descriptions

### Column Descriptions

Use `"` to add a description to the previous column. The description is
enclosed in quotes:

```
$Email 60
"Email "The primary email address for this user"
```

### Table Descriptions

Use `>` at the start of a line within a table stanza:

```
!Contact
>A contact record linked to a user account.
@IDContact
```

Multiple `>` lines are concatenated with paragraph breaks.

## Named Indexes

Declare a named index inside a table stanza with a `+` line. The first token
after `+` is the index name; remaining tokens are a comma-separated column
list:

```
!UserSession
@IDUserSession
~IDUser -> IDUser
$SessionToken 256
&LoginDate
&ExpirationDate

+IX_UserSession_Token SessionToken
+IX_UserSession_UserDate IDUser, LoginDate
```

Prefix the name with `!` to declare a unique index:

```
!User
@IDUser
$UserName 128
$Email 256

+!AK_User_Username UserName
+!AK_User_Email Email
+IX_User_NameEmail UserName, Email
```

Each declared index is carried through to the generated Meadow schema as an
entry in `Indices[]` of the form `{ Name, Columns: [...], Unique }`. The
Meadow connector layer (e.g. `meadow-connection-mysql`) emits the
corresponding `CREATE [UNIQUE] INDEX` SQL via `getIndexDefinitionsFromSchema`,
so `meadow-migrationmanager` picks them up automatically when deploying or
diffing schemas. Index declarations must live inside the table stanza (above
the blank line that closes it).

## Comments

Lines starting with `/` are treated as comments and ignored:

```
/ This is a comment and will be skipped
```

## Domains

Switch the domain context for subsequent table definitions:

```
[Domain Reporting]
```

All tables defined after this directive belong to the `Reporting` domain
until a new domain is declared. The default domain is `Default`.

## Include Files

Include another MicroDDL file to be parsed after the current file:

```
[Include shared-tables.mddl]
```

The path is resolved relative to the directory of the current file.
Multiple includes are processed in sequence after the main file completes.

## Magic Column Names

Certain column names receive special treatment in the Meadow schema,
regardless of their declared data type. These columns enable automatic
audit stamping by the Meadow endpoints:

| Column Name      | Meadow Schema Type | Purpose                        |
|------------------|--------------------|--------------------------------|
| `CreateDate`     | CreateDate         | Auto-set on record creation    |
| `CreatingIDUser` | CreateIDUser       | Auto-set to creating user's ID |
| `UpdateDate`     | UpdateDate         | Auto-set on record update      |
| `UpdatingIDUser` | UpdateIDUser       | Auto-set to updating user's ID |
| `DeleteDate`     | DeleteDate         | Auto-set on soft delete        |
| `DeletingIDUser` | DeleteIDUser       | Auto-set to deleting user's ID |
| `Deleted`        | Deleted            | Soft delete boolean flag       |

## Authorization Stanza

Define per-table authorization rules outside a table definition:

```
[Authorization User]
Create * Allow
Read User MyCustomer
Update User Mine
Delete Manager Allow
```

Each line has three tokens: `Permission Role Authorizer`

- **Permission**: `Create`, `Read`, `Reads`, `ReadsBy`, `ReadMax`,
  `ReadSelectList`, `Update`, `Delete`, `Count`, `CountBy`, `Schema`,
  `Validate`, `New`
- **Role**: A role name (`Unauthenticated`, `Readonly`, `User`, `Manager`,
  `Director`, `Executive`, `Administrator`) or `*` for all roles
- **Authorizer**: `Allow`, `Deny`, `Mine`, `MyCustomer` (or custom)

A blank line ends the authorization stanza.

### Default Roles and Permissions

| Role             | Default Policy    |
|------------------|-------------------|
| Unauthenticated  | Deny all          |
| Readonly         | Read-only (Allow reads, Deny writes) |
| User             | MyCustomer reads, Mine writes |
| Manager          | MyCustomer reads, Mine writes |
| Director         | MyCustomer all    |
| Executive        | MyCustomer all    |
| Administrator    | Allow all         |

## PICT Stanzas

Define UI configuration for Pict views. Each stanza type corresponds to a
CRUD operation:

```
[PICT-Create User]
[PICT-List User]
[PICT-Record User]
[PICT-Update User]
[PICT-Delete User]
```

Within a PICT stanza:

### Title Template

A line wrapped in parentheses sets the title (underscore template):

```
(Create a New <%= EntityName %>)
```

### Properties

A line starting with `:` sets a property:

```
:Enabled = true
:RowMenu = false
```

Boolean strings (`true`/`false`) are converted to actual booleans.

### Section Headings

A line starting with `#` adds a section heading entry:

```
#Personal Information
```

### Column Entries

Any other line defines a column entry. Extra key:value pairs can follow
the column name:

```
UserName Type:text Label:"User Name" Width:200
```

A blank line ends the PICT stanza.

## Complete Example

```
/ User management tables

[Domain Core]

!User
>The primary user table for authentication and identity.
@IDUser
%GUIDUser
$UserName 128
$Email 256
$PasswordHash 128
^Active
{Preferences
{ProfileData ProfileDataJSON
&CreateDate
#CreatingIDUser -> IDUser
&UpdateDate
#UpdatingIDUser -> IDUser
&DeleteDate
#DeletingIDUser -> IDUser
^Deleted
+!AK_User_Username UserName
+IX_User_Email Email

!UserSession
@IDUserSession
#IDUser -> IDUser
$SessionToken 256
&LoginDate
&ExpirationDate
&CreateDate
#CreatingIDUser -> IDUser
+!AK_UserSession_Token SessionToken
+IX_UserSession_UserDate IDUser, LoginDate

[Authorization User]
Read User Mine
Update User Mine
Delete * Deny

[PICT-List User]
(Users)
UserName
Email
Active
```
