import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-6xl mb-4">🤖</div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Page Not Found</h1>
      <p className="text-slate-400 mb-6">This page doesn't exist.</p>
      <Link to="/" className="text-blue-400 underline">
        Go home
      </Link>
    </div>
  );
}
