import { Outlet } from 'react-router-dom';

// Split sign-in: the green rail colour carries the brand; the form sits on a white sheet.
export function AuthLayout() {
  return (
    <div className="grid min-h-[100dvh] bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-rail p-12 text-rail-text lg:flex">
        <div className="inline-flex w-fit rounded-lg bg-white px-3 py-2">
          <img src="/logo.png" alt="Hybits Sterilised Dish" className="h-9 w-auto" />
        </div>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight text-white">
            Every plate out, every rupee owed, on one page.
          </p>
          <p className="mt-4 text-base text-rail-muted">
            Clients, GST invoices, payments and dishware for every Hybits outlet.
          </p>
        </div>
        <p className="text-xs text-rail-muted">Hybits Solutions Pvt Ltd · Bengaluru · Staff access only</p>
        {/* Bill-book perforation down the seam */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-[radial-gradient(circle_at_100%_50%,#F4F7F5_4px,transparent_4.5px)] bg-[length:12px_16px] bg-repeat-y" aria-hidden="true" />
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <img src="/logo.png" alt="Hybits Sterilised Dish" className="mx-auto mb-8 h-14 w-auto lg:hidden" />
          <Outlet />
        </div>
      </section>
    </div>
  );
}
