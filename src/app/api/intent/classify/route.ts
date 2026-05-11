import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyIntent } from "@/lib/intent";

const schema = z.object({ message: z.string().min(1) });

export async function POST(request: Request) {
  const { message } = schema.parse(await request.json());
  return NextResponse.json(await classifyIntent(message));
}
