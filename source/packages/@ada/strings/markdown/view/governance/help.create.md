Use this page to create or update a governance attribute.

**Note**: You cannot rename or delete attributes from the `PII classifications` namespace.

Enter the attribute details (namespace, name, description and alias) and on the next page, select the Lens:

- **Default Lens**: Applies when no group policies are defined. You can choose between `CLEAR`, `HIDDEN` or `HASHED`.
  - `CLEAR`: See the data as is
  - `HIDDEN`: Hide the data completely. Users will not see data in search results.
  - `HASHED`: Create a consistent, tokenized hash for data. Users will see the same value and can create relationships with other datasets without exposing the underlying data.
- **Row Level Policy**: Governance applied at the row level using SQL like filter. For example, specifying _email like '%amazon.com%'_ will apply the governance policy (HIDDEN/HASHED/CLEAR) to rows when column `email` includes `amazon.com`.

**Glossary**

What is a Lens?

Lens are governance policies applied on a user group.