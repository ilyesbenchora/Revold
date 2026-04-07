export default function DashboardPageLoading() {
  return (
    <section className="space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded bg-slate-200" />
      <div className="h-4 w-72 rounded bg-slate-100" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card h-32 p-6" />
        <div className="card h-32 p-6" />
      </div>
      <div className="card h-16 p-5" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="card h-48 p-5" />
        <div className="card h-48 p-5" />
        <div className="card h-48 p-5" />
      </div>
    </section>
  );
}
