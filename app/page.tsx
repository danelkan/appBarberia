import { ArrowRight, CalendarDays, ChevronRight, Clock3, MapPin, Scissors, ShieldCheck, Sparkles, Star, Smartphone } from 'lucide-react'

const BRANCHES = [
  {
    name: 'Cordón',
    address: 'José Enrique Rodó 1969, Montevideo',
    href: 'https://book.weibook.co/branch/felito-barber-studio-sede-1',
    description: 'Acceso directo a la agenda oficial de la sede.',
  },
  {
    name: 'Punta Carretas',
    address: 'Luis Franzini 938, Montevideo',
    href: 'https://book.weibook.co/branch/felito-barber-studio-punta-carretas',
    description: 'Reserva online simple para entrar y agendar en segundos.',
  },
]

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Reserva directa',
    text: 'Cada botón lleva a la agenda oficial de la sede correspondiente.',
  },
  {
    icon: Smartphone,
    title: 'Pensada para celular',
    text: 'La estructura está preparada para que la mayoría de la gente reserve desde el teléfono sin perderse.',
  },
  {
    icon: Sparkles,
    title: 'Imagen más premium',
    text: 'Oscura, prolija y más elegante, sin recargar la carga ni lastimar el SEO.',
  },
]

const STEPS = [
  'Elegís la sede que te queda mejor.',
  'Tocás el botón de reservar.',
  'Entrás a la agenda online oficial.',
  'Seleccionás día, hora y confirmás el turno.',
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-cream">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80">Felito Barber Studio</p>
            <h1 className="mt-1 font-serif text-lg text-cream sm:text-xl">Cordón · Punta Carretas</h1>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <a className="btn-ghost" href="#sedes">Sedes</a>
            <a className="btn-ghost" href="#como-funciona">Cómo funciona</a>
            <a className="btn-gold" href={BRANCHES[0].href} target="_blank" rel="noreferrer">
              Reservar ahora
            </a>
          </div>
        </div>
      </header>

      <section className="hero-grid relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_30%)]" />
        <div className="absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_55%)] lg:block" />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
          <div className="animate-fade-up max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs text-gold shadow-[0_0_30px_rgba(201,168,76,0.08)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sitio optimizado para convertir visitas en reservas
            </div>

            <h2 className="mt-6 max-w-3xl font-serif text-4xl leading-[0.95] text-cream sm:text-5xl lg:text-7xl">
              Reservá tu turno en una web más fuerte, rápida y premium.
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-cream/62 sm:text-lg">
              Esta versión deja mucho más claro qué hace la marca, a qué sedes puede ir el cliente y cuál es el paso exacto para reservar. Menos ruido, más intención de reserva.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a className="btn-gold glow-gold" href={BRANCHES[0].href} target="_blank" rel="noreferrer">
                Reservar en Cordón
                <ArrowRight className="h-4 w-4" />
              </a>
              <a className="btn-outline" href={BRANCHES[1].href} target="_blank" rel="noreferrer">
                Reservar en Punta Carretas
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { value: '2', label: 'sedes visibles' },
                { value: '1 click', label: 'para entrar a reservar' },
                { value: 'mobile first', label: 'pensada para celular' },
              ].map((item) => (
                <div key={item.label} className="glass-card px-4 py-4">
                  <p className="text-2xl font-semibold text-cream">{item.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-cream/40">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-up-delayed">
            <div className="premium-panel overflow-hidden p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Reserva rápida</p>
                  <h3 className="mt-2 font-serif text-2xl text-cream">Entrá por sede</h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/20 bg-gold/10 text-gold">
                  <Scissors className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {BRANCHES.map((branch) => (
                  <a
                    key={branch.name}
                    href={branch.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gold/80">Sede</p>
                        <h4 className="mt-2 text-xl font-medium text-cream">{branch.name}</h4>
                      </div>
                      <div className="rounded-full border border-gold/20 bg-gold/10 p-2 text-gold transition-transform duration-300 group-hover:translate-x-1">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-cream/58">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gold" />
                        <span>{branch.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-gold" />
                        <span>{branch.description}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-gold/20 bg-gold/[0.04] p-4 text-sm text-cream/58">
                El objetivo principal de esta home es que una persona entre, entienda rápido y reserve sin dudar.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <div className="gold-divider mb-4" />
          <p className="text-xs uppercase tracking-[0.24em] text-gold/80">Qué mejora esta versión</p>
          <h2 className="section-title mt-3">Más sensación de marca, sin volver la web pesada</h2>
          <p className="mt-3 text-sm leading-7 text-cream/55 sm:text-base">
            Se subió bastante la calidad visual, pero manteniendo una base liviana: fondos con profundidad, mejores jerarquías, botones más notorios y secciones más claras.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {HIGHLIGHTS.map((item, i) => {
            const Icon = item.icon
            return (
              <div key={item.title} className={`card-hover p-6 ${i === 1 ? 'md:-translate-y-2' : ''}`}>
                <div className="mb-4 inline-flex rounded-full border border-gold/20 bg-gold/10 p-3 text-gold">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium text-cream">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-cream/50">{item.text}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section id="sedes" className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-gold/80">Sedes</p>
            <h2 className="section-title mt-3">Cada sucursal tiene su acceso directo</h2>
            <p className="mt-3 text-sm leading-7 text-cream/55 sm:text-base">
              Esto evita confusión. El cliente no entra a una página genérica: va directo a la sede correcta y desde ahí reserva.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {BRANCHES.map((branch) => (
              <div key={branch.name} className="premium-panel p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Sucursal</p>
                    <h3 className="mt-2 font-serif text-3xl text-cream">{branch.name}</h3>
                  </div>
                  <div className="badge border-gold/20 bg-gold/10 text-gold">Agenda online</div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-cream/58">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gold" />
                    <span>{branch.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-gold" />
                    <span>Entrada rápida a la reserva de esta sede.</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a className="btn-gold" href={branch.href} target="_blank" rel="noreferrer">
                    Ir a reservar
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-gold/80">Cómo funciona</p>
            <h2 className="section-title mt-3">La web está armada para que el recorrido sea obvio</h2>
            <p className="mt-3 text-sm leading-7 text-cream/55 sm:text-base">
              Una persona no tiene que pensar demasiado. La idea es que vea la marca, elija sede y llegue al sistema de reservas sin fricción.
            </p>
          </div>

          <div className="grid gap-3">
            {STEPS.map((step, index) => (
              <div key={step} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/10 text-sm font-semibold text-gold">
                    0{index + 1}
                  </div>
                  <div>
                    <p className="text-base font-medium text-cream">{step}</p>
                    <p className="mt-1 text-sm leading-7 text-cream/50">
                      {index === 0 && 'Las dos ubicaciones quedan súper visibles desde el arranque.'}
                      {index === 1 && 'Los CTA principales están repetidos en lugares estratégicos para subir conversiones.'}
                      {index === 2 && 'Se evita meter pasos innecesarios dentro de la home.'}
                      {index === 3 && 'Eso baja abandono y hace la experiencia mucho más clara.'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="premium-panel flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs text-gold">
                <Star className="h-3.5 w-3.5" />
                Versión más premium y lista para escalar
              </div>
              <h2 className="mt-4 font-serif text-3xl text-cream sm:text-4xl">Ya quedó bastante mejor parada para mostrar marca y empujar reservas.</h2>
              <p className="mt-3 text-sm leading-7 text-cream/55 sm:text-base">
                La base está ordenada, el diseño se ve más sólido y el acceso a las agendas ya está bien resuelto. Desde acá después se pueden sumar más cosas sin romper la estructura.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="btn-gold" href={BRANCHES[0].href} target="_blank" rel="noreferrer">Cordón</a>
              <a className="btn-outline" href={BRANCHES[1].href} target="_blank" rel="noreferrer">Punta Carretas</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
