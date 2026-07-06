"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  LoaderCircle,
} from "lucide-react";
import type { Column, Dataset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/fetcher";
import { formatCount } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = Record<string, string | null>;

interface RowsResponse {
  columns: Column[];
  total: number;
  page: number;
  pageSize: number;
  rows: Row[];
}

const PAGE_SIZE = 200;
const ROW_COL_WIDTH = 56;

const columnHelper = createColumnHelper<Row>();

interface Props {
  dataset: Dataset;
  /** Columns to display (the shared selection), in display order. */
  columns: Column[];
  /** Global text filter, shared with the toolbar search box. */
  q: string;
}

export default function DataGrid({ dataset, columns: visibleColumns, q }: Props) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(
    null,
  );
  const [page, setPage] = useState(0);

  // Any change to the dataset, filter, or sort returns to the first page.
  useEffect(() => setPage(0), [dataset.id, q, sort]);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });
  if (q) params.set("q", q);
  if (sort) {
    params.set("sort", sort.key);
    params.set("dir", sort.dir);
  }
  const { data, isLoading, error } = useSWR<RowsResponse>(
    `/api/datasets/${dataset.id}/rows?${params.toString()}`,
    fetcher,
    { keepPreviousData: true },
  );

  const rows = data?.rows ?? [];

  const columns = useMemo(
    () =>
      visibleColumns.map((c) =>
        columnHelper.accessor((row) => row[c.key], {
          id: c.key,
          header: c.name,
          size: c.type === "number" ? 140 : 220,
          meta: { type: c.type },
        }),
      ),
    [visibleColumns],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 80, maxSize: 1000 },
  });

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null; // third click clears sort
    });
  }

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRow = Math.min(total, page * PAGE_SIZE + rows.length);
  const tableRows = table.getRowModel().rows;
  const tableWidth = ROW_COL_WIDTH + table.getTotalSize();

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-2">
      <Table
        containerClassName="min-h-0 flex-1 overflow-auto rounded-xl border bg-card shadow-sm"
        className="table-fixed"
        style={{ width: tableWidth, minWidth: "100%" }}
      >
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="hover:bg-transparent">
            <TableHead
              style={{ width: ROW_COL_WIDTH }}
              className="bg-muted text-right text-xs text-muted-foreground"
            >
              #
            </TableHead>
            {table.getFlatHeaders().map((header) => {
              const active = sort?.key === header.column.id;
              const numeric =
                (header.column.columnDef.meta as { type?: string } | undefined)
                  ?.type === "number";
              return (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="relative bg-muted p-0 text-muted-foreground"
                >
                  <button
                    onClick={() => toggleSort(header.column.id)}
                    className={cn(
                      "flex h-10 w-full items-center gap-1 px-2 hover:bg-foreground/5",
                      numeric && "flex-row-reverse",
                    )}
                    title={String(header.column.columnDef.header)}
                  >
                    <span className="truncate text-xs uppercase tracking-wider">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </span>
                    {active ? (
                      sort!.dir === "asc" ? (
                        <ChevronUp className="size-3.5 shrink-0 text-secondary" />
                      ) : (
                        <ChevronDown className="size-3.5 shrink-0 text-secondary" />
                      )
                    ) : (
                      <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/40" />
                    )}
                  </button>
                  {/* Drag handle to resize this column. */}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40",
                      header.column.getIsResizing() && "bg-primary/60",
                    )}
                  />
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableRows.length ? (
            tableRows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell
                  style={{ width: ROW_COL_WIDTH }}
                  className="text-right font-mono text-xs text-muted-foreground"
                >
                  {formatCount(firstRow + i)}
                </TableCell>
                {row.getVisibleCells().map((cell) => {
                  const value = cell.getValue() as string | null;
                  const numeric =
                    (
                      cell.column.columnDef.meta as
                        | { type?: string }
                        | undefined
                    )?.type === "number";
                  return (
                    <TableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={cn(
                        "truncate",
                        numeric && "text-right font-mono tabular-nums",
                      )}
                    >
                      {value === null ? (
                        <span className="italic text-muted-foreground/40">
                          null
                        </span>
                      ) : (
                        value
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={visibleColumns.length + 1}
                className="h-24 text-center text-muted-foreground"
              >
                {isLoading
                  ? "Chargement…"
                  : q
                    ? "Aucune ligne ne correspond à votre recherche."
                    : "Ce jeu de données n’a aucune ligne."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination (DataTablePagination style) */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          {isLoading && <LoaderCircle size={12} className="animate-spin" />}
          {total > 0
            ? `${formatCount(firstRow)}–${formatCount(lastRow)} sur ${formatCount(total)} lignes`
            : "0 ligne"}
        </span>
        <span className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Préc.
          </Button>
          <span className="tabular-nums">
            Page {page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            Suiv.
          </Button>
        </span>
      </div>
    </div>
  );
}
