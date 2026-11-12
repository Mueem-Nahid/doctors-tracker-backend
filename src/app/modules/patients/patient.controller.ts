import type { RequestHandler } from "express";
import { sendData } from "../../../shared/sendResponse.js";
import { PatientService } from "./patient.service.js";

const create: RequestHandler = async (request, response) => {
  const { params, body } = request.validated as { params: { id: string }; body: Parameters<typeof PatientService.createForDoctor>[1] };
  sendData(response, 201, await PatientService.createForDoctor(params.id, body));
};

const list: RequestHandler = async (request, response) => {
  const { params, query } = request.validated as { params: { id: string }; query: Parameters<typeof PatientService.listForDoctor>[1] };
  sendData(response, 200, await PatientService.listForDoctor(params.id, query));
};

const remove: RequestHandler = async (request, response) => {
  const { params } = request.validated as { params: { id: string; patientId: string } };
  await PatientService.deleteForDoctor(params.id, params.patientId);
  response.status(204).end();
};

export const PatientController = { create, list, remove };
