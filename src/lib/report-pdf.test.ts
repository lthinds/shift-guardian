import { describe, expect, it } from "vitest";
import { buildReport, normalizeBrand } from "./report-pdf";
import type { EventRow } from "./safenet";

const ev = (p: Partial<EventRow>): EventRow => ({ id: Math.random().toString(), client_id: "c", kind: "arm", event_date: "2026-06-15", event_time: "08:00", user_name: "Ana", device_name: "Controle", by_operator: false, sensor_id: null, sensor_ids: [], sensor_labels: null, end_time: null, custom: {}, description: null, status: null, operator_id: null, archived: false, created_at: "", ...p });
const base = { brand: "reggra" as const, kind: "weekly" as const, clientName: "1234 - Criando com Arte II", from: "2026-06-15", to: "2026-06-16", days: ["2026-06-15", "2026-06-16"], bypasses: [], sensorName: () => "Zona 1" };

describe("relatórios PDF", () => {
  it("lista todos os armes e desarmes do dia em ordem cronológica", () => {
    const d = buildReport({ ...base, events: [ev({ kind: "disarm", event_time: "13:15" }), ev({ kind: "disarm", event_time: "06:45" }), ev({ kind: "arm", event_time: "12:00" })] });
    expect(d.days[0]!.disarms.map((x) => x.time)).toEqual(["06:45", "13:15"]);
    expect(d.days[0]!.arms.map((x) => x.time)).toEqual(["12:00"]);
  });
  it("oculta o código do cliente e usa só o primeiro nome do operador", () => {
    const d = buildReport({ ...base, events: [ev({ by_operator: true, user_name: "Lucas Hinds" })] });
    expect(d.client).toBe("Criando com Arte II");
    expect(d.days[0]!.arms[0]!.who).toBe("Lucas (operador)");
  });
  it("cliente sem empresa definida usa Reggra", () => {
    expect(normalizeBrand(null)).toBe("reggra");
    expect(normalizeBrand("safenet")).toBe("safenet");
  });
});
