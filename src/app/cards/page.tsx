import Link from "next/link";
import { Sparkles } from "lucide-react";
import { listMintedCards } from "@/lib/minted-cards";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CardsGalleryPage() {
  const cards = await listMintedCards();
  const heroCard = cards[0];
  const galleryCards = heroCard ? cards.slice(1) : cards;

  return (
    <main
      className="min-h-dvh bg-[radial-gradient(circle_at_top_left,#ecfccb,transparent_34%),linear-gradient(135deg,#f8fafc,#e0f2fe_48%,#fefce8)] px-4 py-6 text-slate-950 sm:px-6 lg:px-10"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-7xl gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur md:p-6">
          <div className="max-w-2xl">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-lime-300 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
              <Sparkles aria-hidden="true" size={14} />
              Minted collection
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              Realistic Pokemon card gallery
            </h1>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-600 sm:text-base">
              Every minted card is saved to the shared card vault so finished
              realistic renders can be browsed, downloaded, and celebrated.
            </p>
          </div>
          <Link
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
            href="/"
          >
            Create another card
          </Link>
        </header>

        {heroCard ? (
          <section className="grid gap-6 rounded-[2rem] border border-white/70 bg-slate-950 p-4 text-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:p-6">
            <div className="flex items-center justify-center rounded-[1.5rem] bg-white/10 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${heroCard.pokemonName} minted card`}
                className="max-h-[72dvh] rounded-[1.25rem] object-contain shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
                src={heroCard.renderUrl}
              />
            </div>
            <div className="flex flex-col justify-center gap-4 p-2 md:p-6">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-lime-300">
                Latest mint
              </p>
              <h2 className="text-4xl font-black leading-none tracking-tight sm:text-6xl">
                {heroCard.pokemonName}
              </h2>
              <p className="text-sm font-bold text-slate-300">
                Minted {formatDate(heroCard.uploadedAt)} · Stored on {heroCard.source === "blob" ? "Vercel Blob" : "local storage"}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  className="rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-lime-200"
                  href={heroCard.downloadUrl}
                >
                  Download card
                </a>
                <a
                  className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                  href={heroCard.renderUrl}
                >
                  Open image
                </a>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid min-h-[420px] place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-8 text-center shadow-sm">
            <div className="max-w-md">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-lime-300 text-slate-950">
                <Sparkles aria-hidden="true" size={28} />
              </div>
              <h2 className="text-2xl font-black">No minted cards yet</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                Create a Pokemon card, place your colored art, customize the
                details, and mint it to add the first card to this gallery.
              </p>
              <Link
                className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
                href="/"
              >
                Start minting
              </Link>
            </div>
          </section>
        )}

        {galleryCards.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {galleryCards.map((card) => (
              <article
                key={card.pathname}
                className="group overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 p-3 shadow-[0_18px_55px_rgba(15,23,42,0.10)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
              >
                <a className="block" href={card.renderUrl}>
                  <div className="grid aspect-[63/88] place-items-center overflow-hidden rounded-[1.25rem] bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`${card.pokemonName} minted card`}
                      className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      src={card.renderUrl}
                    />
                  </div>
                </a>
                <div className="grid gap-2 p-3">
                  <h3 className="truncate text-lg font-black">{card.pokemonName}</h3>
                  <p className="text-xs font-bold text-slate-500">
                    {formatDate(card.uploadedAt)} · {card.source === "blob" ? "Blob" : "Local"}
                  </p>
                  <a
                    className="mt-1 rounded-full bg-slate-100 px-3 py-2 text-center text-xs font-black text-slate-700 transition hover:bg-slate-950 hover:text-white"
                    href={card.downloadUrl}
                  >
                    Download
                  </a>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
