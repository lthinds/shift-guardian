// Relatórios em PDF (diário, semanal, mensal) no formato de slides 16:9.
// A parte de dados (buildReport) é pura e testada; o desenho usa jsPDF no navegador.
import { clientDisplayName, firstName, formatBR, hhmm, weekdayLabel, type EventRow } from "@/lib/safenet";
import { BRAND_LOGO_URL } from "@/lib/branding";

export type Brand = "reggra" | "safenet";
export type ReportKind = "daily" | "weekly" | "monthly";

export const BRANDS: Record<Brand, { name: string; tagline: string; navy: string; accents: string[]; soft: string; text: string }> = {
  safenet: { name: "Safenet", tagline: "Tecnologia Inteligente", navy: "#111C38", accents: ["#3EA6DD", "#96BF1E", "#D11355", "#E55220"], soft: "#F0F6FA", text: "#1E293B" },
  reggra: { name: "Reggra", tagline: "Serviços Especializados", navy: "#0F2A4A", accents: ["#2F5D8C", "#4BA3E3", "#C9A227", "#8DB3D9"], soft: "#F1F5FA", text: "#1E293B" },
};

export const normalizeBrand = (b: unknown): Brand => (b === "safenet" ? "safenet" : "reggra");

export interface ReportBypass { sensor: string; reason: string | null; start_date: string; end_date: string | null }
export interface ReportInput { brand: Brand; kind: ReportKind; clientName: string; from: string; to: string; days: string[]; events: EventRow[]; bypasses: ReportBypass[]; sensorName: (e: EventRow) => string }

export interface ArmItem { time: string; who: string }
export interface ReportData {
  title: string; client: string; period: string;
  days: { date: string; label: string; disarms: ArmItem[]; arms: ArmItem[] }[];
  triggers: { date: string; time: string; sensor: string; status: string; description: string }[];
  maintenance: { date: string; time: string; description: string; status: string }[];
  observations: { date: string; time: string; description: string }[];
  bypasses: { sensor: string; reason: string; period: string; active: boolean }[];
  kpis: { disarms: number; arms: number; triggers: number; bypasses: number; maintenance: number; daysWithoutArm: number };
  weeks: { label: string; disarms: number; arms: number; triggers: number }[];
}

const who = (e: EventRow) => (e.by_operator ? `${firstName(e.user_name ?? "Operador")} (operador)` : e.user_name?.trim() || "—");
const byTime = (a: EventRow, b: EventRow) => (a.event_date + (a.event_time ?? "")).localeCompare(b.event_date + (b.event_time ?? ""));

export function buildReport(i: ReportInput): ReportData {
  const ev = [...i.events].sort(byTime);
  const days = i.days.map((date) => ({
    date, label: weekdayLabel(date),
    // Todos os acionamentos do dia, em ordem cronológica; desarmes vêm antes dos armes.
    disarms: ev.filter((e) => e.event_date === date && e.kind === "disarm").map((e) => ({ time: hhmm(e.event_time), who: who(e) })),
    arms: ev.filter((e) => e.event_date === date && e.kind === "arm").map((e) => ({ time: hhmm(e.event_time), who: who(e) })),
  }));
  const triggers = ev.filter((e) => e.kind === "trigger").map((e) => ({
    date: e.event_date, time: hhmm(e.event_time) + (e.end_time ? ` às ${hhmm(e.end_time)}` : ""), sensor: i.sensorName(e), status: e.status ?? "", description: e.description ?? "",
  }));
  const maintenance = ev.filter((e) => e.kind === "maintenance").map((e) => ({ date: e.event_date, time: hhmm(e.event_time), description: e.description ?? "", status: e.status ?? "" }));
  const observations = ev.filter((e) => e.kind === "observation").map((e) => ({ date: e.event_date, time: hhmm(e.event_time), description: e.description ?? "" }));
  const bypasses = i.bypasses.map((b) => ({ sensor: b.sensor, reason: b.reason ?? "", period: `${formatBR(b.start_date)} – ${b.end_date ? formatBR(b.end_date) : "em aberto"}`, active: !b.end_date || b.end_date > i.to }));
  const weeks: ReportData["weeks"] = [];
  for (let k = 0; k < i.days.length; k += 7) {
    const span = i.days.slice(k, k + 7), set = new Set(span);
    const n = (kind: EventRow["kind"]) => ev.filter((e) => e.kind === kind && set.has(e.event_date)).length;
    weeks.push({ label: `${formatBR(span[0]!).slice(0, 5)} – ${formatBR(span.at(-1)!).slice(0, 5)}`, disarms: n("disarm"), arms: n("arm"), triggers: n("trigger") });
  }
  const title = { daily: "Relatório Diário", weekly: "Relatório Semanal", monthly: "Consolidado Mensal" }[i.kind];
  return {
    title, client: clientDisplayName(i.clientName),
    period: i.from === i.to ? formatBR(i.from) : `${formatBR(i.from)} a ${formatBR(i.to)}`,
    days, triggers, maintenance, observations, bypasses, weeks,
    kpis: {
      disarms: days.reduce((s, d) => s + d.disarms.length, 0), arms: days.reduce((s, d) => s + d.arms.length, 0),
      triggers: triggers.length, bypasses: bypasses.length, maintenance: maintenance.length,
      daysWithoutArm: days.filter((d) => d.disarms.length > 0 && d.arms.length === 0).length,
    },
  };
}

/* ------------------------------ desenho ------------------------------ */
type PDF = import("jspdf").jsPDF;
const W = 720, H = 405, M = 28;
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16)) as [number, number, number];

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const data = await new Promise<string>((ok, err) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = err; r.readAsDataURL(blob); });
    const img = new Image(); img.src = data; await img.decode();
    return { data, w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; }
}

export async function generateReportPDF(input: ReportInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [W, H] });
  const b = BRANDS[input.brand];
  const d = buildReport(input);
  const logo = await loadImage(BRAND_LOGO_URL[input.brand]);
  const fill = (hex: string) => pdf.setFillColor(...rgb(hex));
  const color = (hex: string) => pdf.setTextColor(...rgb(hex));
  const font = (size: number, bold = false) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size); };
  let page = 0;

  const stripe = (y: number, h: number) => {
    const n = 36, w = W / n;
    for (let k = 0; k < n; k++) { fill(b.accents[k % b.accents.length]!); pdf.triangle(k * w, y + h, (k + 1) * w, y + h, k * w + (k % 2 ? w : 0), y, "F"); }
  };
  const drawLogo = (x: number, y: number, maxW: number, maxH: number) => {
    if (!logo) { font(16, true); color(b.navy); pdf.text(b.name.toUpperCase(), x, y + maxH / 2 + 5); return; }
    const s = Math.min(maxW / logo.w, maxH / logo.h);
    pdf.addImage(logo.data, "JPEG", x, y, logo.w * s, logo.h * s);
  };
  const newSlide = (title: string, subtitle = "") => {
    if (page++) pdf.addPage([W, H], "landscape");
    fill("#FFFFFF"); pdf.rect(0, 0, W, H, "F");
    fill(b.navy); pdf.rect(0, 0, W, 54, "F");
    fill(b.accents[0]!); pdf.rect(0, 54, W, 3, "F");
    font(18, true); color("#FFFFFF"); pdf.text(title, M, 33);
    if (subtitle) { font(9); color("#CBD5E1"); pdf.text(subtitle, M, 46); }
    fill("#FFFFFF"); pdf.roundedRect(W - 150, 9, 128, 36, 4, 4, "F"); drawLogo(W - 144, 13, 116, 28);
    stripe(H - 10, 10);
    font(7); color("#64748B");
    pdf.text(`${b.name} ${b.tagline} · ${d.client} · ${d.period}`, M, H - 16);
    pdf.text(String(page), W - M, H - 16, { align: "right" });
  };
  const cover = () => {
    page++;
    fill(b.navy); pdf.rect(0, 0, W, H, "F");
    fill("#FFFFFF"); pdf.roundedRect(M, 34, 230, 76, 6, 6, "F"); drawLogo(M + 12, 44, 206, 56);
    font(30, true); color("#FFFFFF"); pdf.text(d.title, M, 180);
    font(20); pdf.text(d.client, M, 212, { maxWidth: W - 2 * M });
    font(12); color("#CBD5E1"); pdf.text(d.period, M, 236);
    fill(b.accents[0]!); pdf.rect(M, 250, 70, 4, "F");
    font(9); pdf.text(`Monitoramento ${b.name} · ${b.tagline}`, M, 340);
    stripe(H - 40, 40);
  };
  const kpi = (x: number, y: number, w: number, label: string, value: number, accent: string) => {
    fill(b.soft); pdf.roundedRect(x, y, w, 62, 5, 5, "F");
    fill(accent); pdf.rect(x, y + 8, 3, 46, "F");
    font(24, true); color(b.text); pdf.text(String(value), x + 14, y + 34);
    font(8); color("#475569"); pdf.text(label.toUpperCase(), x + 14, y + 50);
  };
  const kpiRow = (y: number) => {
    const items: [string, number][] = [["Desarmes", d.kpis.disarms], ["Armes", d.kpis.arms], ["Disparos", d.kpis.triggers], ["Zonas inibidas", d.kpis.bypasses], ["Visitas técnicas", d.kpis.maintenance]];
    const w = (W - 2 * M - 4 * 10) / 5;
    items.forEach(([l, v], k) => kpi(M + k * (w + 10), y, w, l, v, l === "Disparos" && v ? "#C2410C" : b.accents[k % b.accents.length]!));
  };
  /** Tabela com quebra automática de página. */
  const table = (title: string, subtitle: string, cols: { h: string; w: number }[], rows: string[][], empty: string, startY = 70) => {
    newSlide(title, subtitle);
    let y = startY;
    const header = () => {
      fill(b.navy); pdf.rect(M, y, W - 2 * M, 18, "F"); font(8, true); color("#FFFFFF");
      let x = M + 6; for (const c of cols) { pdf.text(c.h.toUpperCase(), x, y + 12); x += c.w; } y += 18;
    };
    header();
    if (!rows.length) { font(10); color("#64748B"); pdf.text(empty, M + 6, y + 18); return; }
    rows.forEach((r, k) => {
      font(8.5);
      const lines = r.map((v, c) => pdf.splitTextToSize(v || "—", cols[c]!.w - 10) as string[]);
      const h = Math.max(...lines.map((l) => l.length)) * 10 + 8;
      if (y + h > H - 30) { newSlide(`${title} (cont.)`, subtitle); y = startY; header(); font(8.5); }
      if (k % 2) { fill(b.soft); pdf.rect(M, y, W - 2 * M, h, "F"); }
      color(b.text); let x = M + 6;
      lines.forEach((l, c) => { pdf.text(l, x, y + 12); x += cols[c]!.w; });
      y += h;
    });
  };
  /** Cards por dia com TODOS os acionamentos (desarme ou arme). */
  const dayCards = (kind: "disarms" | "arms") => {
    const label = kind === "disarms" ? "Desarme" : "Arme";
    newSlide(`${label} — dia a dia`, "Todos os acionamentos do dia, em ordem cronológica");
    const n = Math.max(d.days.length, 1), gap = 8, w = (W - 2 * M - gap * (n - 1)) / n, top = 72, h = H - top - 34;
    d.days.forEach((day, k) => {
      const x = M + k * (w + gap), items = day[kind];
      fill(b.soft); pdf.roundedRect(x, top, w, h, 5, 5, "F");
      fill(kind === "disarms" ? b.accents[2]! : b.accents[1]!); pdf.rect(x, top, w, 4, "F");
      font(9, true); color(b.navy); pdf.text(day.label.toUpperCase(), x + 8, top + 20);
      font(8); color("#64748B"); pdf.text(formatBR(day.date).slice(0, 5), x + w - 8, top + 20, { align: "right" });
      let y = top + 40;
      if (!items.length) { font(8); color("#94A3B8"); pdf.text("Sem registro", x + 8, y); }
      for (const it of items) {
        if (y > top + h - 14) { font(7); color("#64748B"); pdf.text("…", x + 8, y); break; }
        font(13, true); color(b.text); pdf.text(it.time, x + 8, y);
        font(7.5); color("#475569"); pdf.text(pdf.splitTextToSize(it.who, w - 16)[0] as string, x + 8, y + 11);
        y += 30;
      }
    });
  };
  const bars = (x: number, y: number, w: number, h: number) => {
    font(10, true); color(b.navy); pdf.text("Disparos por semana", x, y - 8);
    const max = Math.max(1, ...d.weeks.map((wk) => wk.triggers)), bw = w / Math.max(d.weeks.length, 1);
    d.weeks.forEach((wk, k) => {
      const bh = (wk.triggers / max) * (h - 30), bx = x + k * bw + bw * 0.2;
      fill(b.accents[k % b.accents.length]!); pdf.rect(bx, y + h - 20 - bh, bw * 0.6, bh, "F");
      font(9, true); color(b.text); pdf.text(String(wk.triggers), bx + bw * 0.3, y + h - 24 - bh, { align: "center" });
      font(7); color("#64748B"); pdf.text(wk.label, bx + bw * 0.3, y + h - 8, { align: "center" });
    });
  };

  const trigRows = d.triggers.map((t) => [formatBR(t.date), t.time, t.sensor, t.status, t.description]);
  const trigCols = [{ h: "Data", w: 70 }, { h: "Horário", w: 80 }, { h: "Sensor / zona", w: 190 }, { h: "Classificação", w: 110 }, { h: "Descrição", w: 214 }];
  const bypassRows = d.bypasses.map((z) => [z.sensor, z.period, z.active ? "Ativa" : "Liberada", z.reason]);
  const bypassCols = [{ h: "Sensor / zona", w: 200 }, { h: "Período", w: 150 }, { h: "Situação", w: 80 }, { h: "Motivo", w: 234 }];
  const mainRows = d.maintenance.map((m) => [formatBR(m.date), m.time, m.status, m.description]);
  const mainCols = [{ h: "Data", w: 70 }, { h: "Horário", w: 60 }, { h: "Situação", w: 110 }, { h: "Descrição", w: 424 }];
  const obsRows = d.observations.map((o) => [formatBR(o.date), o.time, o.description]);
  const obsCols = [{ h: "Data", w: 70 }, { h: "Horário", w: 60 }, { h: "Ponto de atenção", w: 534 }];

  if (input.kind === "daily") {
    cover();
    newSlide("Resumo do dia", `${weekdayLabel(input.from)} · ${d.period}`);
    kpiRow(70);
    const day = d.days[0];
    (["disarms", "arms"] as const).forEach((k, c) => {
      const x = M + c * ((W - 2 * M) / 2 + 5), w = (W - 2 * M) / 2 - 5, y = 146;
      fill(b.soft); pdf.roundedRect(x, y, w, 210, 5, 5, "F");
      fill(c ? b.accents[1]! : b.accents[2]!); pdf.rect(x, y, w, 4, "F");
      font(11, true); color(b.navy); pdf.text(c ? "Armes" : "Desarmes", x + 10, y + 22);
      let yy = y + 42; const items = day?.[k] ?? [];
      if (!items.length) { font(9); color("#94A3B8"); pdf.text("Sem registro no dia", x + 10, yy); }
      for (const it of items.slice(0, 8)) { font(12, true); color(b.text); pdf.text(it.time, x + 10, yy); font(9); color("#475569"); pdf.text(it.who, x + 60, yy); yy += 20; }
    });
    table("Disparos do dia", d.period, trigCols, trigRows, "Nenhum disparo registrado no dia.");
    table("Zonas inibidas", d.period, bypassCols, bypassRows, "Nenhuma zona inibida.");
    if (mainRows.length) table("Visitas técnicas", d.period, mainCols, mainRows, "");
    table("Pontos de atenção", d.period, obsCols, obsRows, "Nenhum ponto de atenção registrado.");
  } else if (input.kind === "weekly") {
    cover();
    newSlide("Resumo da semana", d.period); kpiRow(70);
    font(10, true); color(b.navy); pdf.text("Destaques", M, 160);
    font(9.5); color(b.text);
    [`${d.kpis.disarms} desarmes e ${d.kpis.arms} armes registrados na semana.`,
     d.kpis.daysWithoutArm ? `Atenção: ${d.kpis.daysWithoutArm} dia(s) com desarme sem arme registrado.` : "Todos os dias com desarme tiveram arme registrado.",
     `${d.kpis.triggers} disparo(s) · ${d.kpis.bypasses} zona(s) inibida(s) · ${d.kpis.maintenance} visita(s) técnica(s).`].forEach((t, k) => pdf.text(`•  ${t}`, M, 180 + k * 18));
    dayCards("disarms"); dayCards("arms");
    table("Disparos", d.period, trigCols, trigRows, "Nenhum disparo registrado na semana.");
    table("Zonas inibidas", d.period, bypassCols, bypassRows, "Nenhuma zona inibida na semana.");
    table("Visitas técnicas", d.period, mainCols, mainRows, "Nenhuma visita técnica na semana.");
    table("Pontos de atenção", d.period, obsCols, obsRows, "Nenhum ponto de atenção registrado.");
  } else {
    cover();
    newSlide("Visão geral do mês", d.period); kpiRow(70);
    bars(M, 175, W - 2 * M, 190);
    table("Desarme e arme por semana", d.period, [{ h: "Semana", w: 200 }, { h: "Desarmes", w: 150 }, { h: "Armes", w: 150 }, { h: "Disparos", w: 164 }],
      d.weeks.map((wk) => [wk.label, String(wk.disarms), String(wk.arms), String(wk.triggers)]), "Sem registros no mês.");
    table("Disparos do mês", d.period, trigCols, trigRows, "Nenhum disparo registrado no mês.");
    table("Zonas inibidas", d.period, bypassCols, bypassRows, "Nenhuma zona inibida no mês.");
    table("Visitas técnicas", d.period, mainCols, mainRows, "Nenhuma visita técnica no mês.");
    table("Pontos de atenção e pendências", d.period, obsCols, obsRows, "Nenhum ponto de atenção registrado.");
  }
  return pdf.output("blob");
}
