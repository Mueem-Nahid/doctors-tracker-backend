import type { Response } from "express";

export function sendData<T>(response: Response, statusCode: number, data: T): void {
  response.status(statusCode).json({ data });
}
