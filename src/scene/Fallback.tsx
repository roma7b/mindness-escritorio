import { STATUS_META, type OfficeView } from "../../shared/office";

export function FallbackRoom({ view, onSelect }: { view: OfficeView; onSelect: (id: string) => void }) {
  const rooms = view.bots.filter((bot) => bot.areaKind !== "home");
  const home = view.bots.filter((bot) => bot.areaKind === "home");
  return (
    <div className="fallback" role="img" aria-label="Sala em modo simples, sem WebGL">
      <div className="fallback-room">
        <p>Prospecção</p>
        <div className="fallback-blobs">
          {rooms.map((bot) => (
            <button key={bot.id} type="button" onClick={() => onSelect(bot.id)} style={{ background: bot.color }}>
              <span>{bot.short}</span>
              <small>{STATUS_META[bot.status].label}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="fallback-homes">
        {home.map((bot) => (
          <button key={bot.id} type="button" title={bot.name} onClick={() => onSelect(bot.id)} style={{ background: bot.color }} />
        ))}
      </div>
      <p className="fallback-note">WebGL indisponível. A lista do time continua valendo.</p>
    </div>
  );
}
