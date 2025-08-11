export default function PricingPage() {
  const plans = [
    { name: "Free", price: "$0", note: "Up to 3 podcasts / month", key: "FREE" },
    { name: "Basic", price: "$19", note: "Up to 15 podcasts / month", key: "BASIC" },
    { name: "Premium", price: "$30", note: "Up to 60 podcasts / month", key: "PREMIUM" },
  ];
  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold gradient-text mb-3">Pricing</h1>
          <p className="text-[#cccccc]">Choose the plan that fits your podcasting needs</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div key={p.key} className="card flex flex-col items-center text-center">
              <div className="text-white text-2xl font-semibold mb-2">{p.name}</div>
              <div className="text-4xl font-extrabold text-white mb-1">{p.price}<span className="text-base font-medium text-[#cccccc]">/mo</span></div>
              <div className="text-[#cccccc] mb-6">{p.note}</div>
              <form action="/api/user" method="post" className="w-full">
                <input type="hidden" name="plan" value={p.key} />
                <button className="btn-primary w-full py-3">Choose {p.name}</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


