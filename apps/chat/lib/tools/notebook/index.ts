/**
 * Notebook tool — execute SQL/Python against the user's financial data.
 *
 * Commands:
 *   create_cell  — Create a new notebook cell (SQL or Python)
 *   view_cell    — View the contents and output of a cell
 *   edit_cell    — Modify an existing cell
 *   execute_cell — Run a cell against DuckDB and return results
 *
 * The notebook maintains a Jupyter-like kernel with a pre-configured
 * DuckDB connection (`conn`) that has views over all parquet tables
 * in the user's local data lake.
 *
 * TODO: Implement Jupyter kernel communication
 */

export const NOTEBOOK_TOOL_NAME = "Notebook";

export const NOTEBOOK_TOOL_DESCRIPTION =
  "Execute SQL queries and Python code against the user's financial data. " +
  "Use SQL for data queries and Python for calculations and visualizations.";
