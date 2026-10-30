const orbs = [
  { size: 126, left: "4%", top: "26%" },
  { size: 74, left: "38%", top: "5%" },
  { size: 110, left: "61%", top: "19%" },
  { size: 152, left: "36%", top: "39%" },
  { size: 68, left: "11%", top: "58%" },
  { size: 70, left: "77%", top: "58%" },
  { size: 122, left: "7%", top: "73%" },
  { size: 116, left: "63%", top: "76%" },
  { size: 64, left: "44%", top: "88%" }
];

export function GlassOrbCluster({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none relative ${className}`}>
      {orbs.map((orb) => (
        <span
          key={`${orb.left}-${orb.top}`}
          className="glass-orb absolute"
          style={{ width: orb.size, height: orb.size, left: orb.left, top: orb.top }}
        />
      ))}
    </div>
  );
}
