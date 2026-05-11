import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    content_md:
      "# Comparative Report\n\nThe comparison endpoint is scaffolded for Gemini synthesis over two report contexts.",
  });
}
