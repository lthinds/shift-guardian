import { describe, it, expect } from "vitest";
import { weekDays, buildClientBlock, nextShiftType, type EventRow } from "./safenet";

const ev = (p: Partial<EventRow>): EventRow => ({
  id: "1", client_id: "c", kind: "arm", event_date: "2026-10-06", event_time: null, user_name: null,
  device_name: null, by_operator: false, sensor_id: null, description: null, status: null,
  operator_id: null, archived: false, created_at: "", ...p,
});

describe("semana", () => {
  it("vai de segunda a domingo", () => {
    const d = weekDays(new Date(2026, 9, 8)); // quinta 08/10/2026
    expect(d[0]).toBe("2026-10-05");
    expect(d[6]).toBe("2026-10-11");
  });
  it("domingo pertence à semana anterior iniciada na segunda", () => {
    expect(weekDays(new Date(2026, 9, 11))[0]).toBe("2026-10-05");
  });
});

describe("mensagem de passagem de plantão", () => {
  it("segue o modelo do WhatsApp", () => {
    const msg = buildClientBlock(
      {
        clientName: "Empresa Cliente Teste 1",
        date: "2026-10-06",
        events: [ev({ kind: "disarm", event_time: "06:49:00", user_name: "Fulano" })],
        newBypasses: [],
        sensorLabel: () => "",
      },
      { shiftType: "Diurno", operatorName: "Operador Lucas", nextShiftType: "Noturno", nextOperatorName: "operador Daniel" },
    );
    expect(msg).toBe(
      "(Empresa Cliente Teste 1)\n\nRelatório de Plantão:\n\n*Data:* 06/10/2026\n\nPlantão Finalizado: sem alterações\n\nTurno: Diurno\n\nNome: Operador Lucas\n\n*Desarme: 06:49 por Fulano - Arme:*\n\nObservações: S/A\n\nPlantão Iniciado: sem alterações\n\nTurno: Noturno\n\nNome: operador Daniel",
    );
  });
  it("alterna o turno", () => {
    expect(nextShiftType("Diurno")).toBe("Noturno");
    expect(nextShiftType("Noturno")).toBe("Diurno");
  });
});
