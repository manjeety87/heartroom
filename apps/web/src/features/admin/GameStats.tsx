import { gameInfo } from "@/features/room/games";
import type { AdminStats } from "@/lib/admin/query";
import { formatCount, formatPercent } from "./format.ts";

const gameName = (id: string) => gameInfo(id)?.label ?? id;
const th = "py-2 pr-3 font-semibold";
const num = "py-2 pr-3 text-right tabular-nums";

/** Totals from the database: games per game, the abandoned rate, top winners, voice, room events. */
export function GameStats({ stats }: { readonly stats: AdminStats }) {
  return (
    <div className="flex flex-col gap-8">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
        <Stat label="Rooms opened (24 h)" value={stats.rooms24h.created} />
        <Stat label="Closed by admin (24 h)" value={stats.rooms24h.closedByAdmin} />
        <Stat label="Players removed (24 h)" value={stats.rooms24h.kicked} />
        <Stat
          label="Voice this month"
          value={`${String(Math.round(stats.voice.monthMinutes))} min`}
          note={`${String(stats.voice.openSessions)} in voice now`}
        />
      </dl>

      <section aria-labelledby="games-played" className="flex flex-col gap-2">
        <h2 id="games-played" className="font-display text-title font-bold tracking-tight text-ink">
          Games played
        </h2>
        {stats.games.length === 0 ? (
          <p className="text-small text-pencil">No online games yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-small text-ink">
              <thead>
                <tr className="border-b border-line text-caption text-pencil">
                  <th scope="col" className={th}>
                    Game
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    7 days
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    30 days
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    All time
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Abandoned
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.games.map((g) => (
                  <tr key={g.gameId} className="border-b border-line">
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      {gameName(g.gameId)}
                    </th>
                    <td className={num}>{g.last7Days}</td>
                    <td className={num}>{g.last30Days}</td>
                    <td className={num}>{g.total}</td>
                    <td className={num}>
                      {g.abandoned}{" "}
                      <span className="text-pencil">({formatPercent(g.abandonedRate)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {stats.winners.map(({ gameId, rows }) => (
        <section key={gameId} aria-labelledby={`wins-${gameId}`} className="flex flex-col gap-2">
          <h2
            id={`wins-${gameId}`}
            className="font-display text-title font-bold tracking-tight text-ink"
          >
            Most wins: {gameName(gameId)}
          </h2>
          <p className="text-caption text-pencil">
            Every finished game, ranked or not. A shared win counts as 1/k.
          </p>
          <table className="w-full border-collapse text-left text-small text-ink">
            <thead>
              <tr className="border-b border-line text-caption text-pencil">
                <th scope="col" className={th}>
                  Player
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Wins
                </th>
                <th scope="col" className={`${th} text-right`}>
                  Games
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-line">
                  <td className="max-w-0 truncate py-2 pr-3">
                    {row.name}
                    {row.isGuest && <span className="text-pencil"> (guest)</span>}
                  </td>
                  <td className={num}>{formatCount(row.wins)}</td>
                  <td className={num}>{row.played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  readonly label: string;
  readonly value: number | string;
  readonly note?: string;
}) {
  return (
    <div className="bg-paper p-3">
      <dt className="text-caption text-pencil">{label}</dt>
      <dd className="text-body font-semibold tabular-nums text-ink">
        {value}
        {note !== undefined && (
          <span className="block text-caption font-normal text-pencil">{note}</span>
        )}
      </dd>
    </div>
  );
}
