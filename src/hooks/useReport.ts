"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/types";

export function useReport(reportId?: string | null) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!reportId) return;
    void fetch(`/api/reports/${reportId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setReport(data));
  }, [reportId]);

  return report;
}
