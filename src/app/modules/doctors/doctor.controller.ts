import type { RequestHandler } from "express";
import { sendData } from "../../../shared/sendResponse.js";
import { DoctorService } from "./doctor.service.js";

const create: RequestHandler = async (request, response) => {
  const { body } = request.validated as { body: Parameters<typeof DoctorService.create>[0] };
  sendData(response, 201, await DoctorService.create(body));
};

const list: RequestHandler = async (request, response) => {
  const { query } = request.validated as { query: Parameters<typeof DoctorService.list>[0] };
  sendData(response, 200, await DoctorService.list(query));
};

const getById: RequestHandler = async (request, response) => {
  const { params } = request.validated as { params: { id: string } };
  sendData(response, 200, await DoctorService.getById(params.id));
};

const filters: RequestHandler = async (_request, response) => {
  sendData(response, 200, await DoctorService.filterOptions());
};

export const DoctorController = { create, list, getById, filters };
