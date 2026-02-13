export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-800 bg-[#0b111b]">
      <div className="mx-auto max-w-7xl px-3 py-4 text-center text-sm text-zinc-400 sm:px-5 lg:px-6">
        &copy; {new Date().getFullYear()} Footy
      </div>
    </footer>
  );
}
