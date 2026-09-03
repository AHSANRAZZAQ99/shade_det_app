import React from "react";

function LogsPanel({ logs = [] }) {
	const displayLogs = logs.length > 0
		? logs
		: ["Waiting for realtime backend logs..."];

	return (
		<section className="rounded-lg border border-[var(--panel-border)] bg-[#d9dde3] p-1.5 shadow-sm">
			<div className="mb-1.5 flex items-center justify-between border-b border-[#b9c2ce] px-1.5 pb-1.5">
				<h3 className="text-[22px] font-bold text-steel-700">Recent Logs</h3>
				<div className="flex gap-2 text-[#8694aa]">
					<span className="h-2.5 w-2.5 rounded-full bg-current" />
					<span className="h-2.5 w-2.5 rounded-full bg-current" />
					<span className="h-2.5 w-2.5 rounded-full bg-current" />
				</div>
			</div>

			<div className="max-h-[140px] overflow-auto rounded border border-[#bcc6d3] bg-[#e7ebf2]">
				{displayLogs.map((entry, index) => (
					<div key={`${entry}-${index}`} className="border-b border-[#ccd4de] px-2 py-1.5 text-[16px] font-medium text-[#3a4f69] last:border-b-0">
						{entry}
					</div>
				))}
			</div>

			<div className="mt-1.5 rounded border border-[#b8c4d3] bg-[#e6ebf2] p-1.5">
				<svg className="h-12 w-full" viewBox="0 0 360 80" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M10 60 L50 48 L80 45 L110 30 L145 50 L180 54 L220 36 L260 56 L305 48 L335 38 L350 50" stroke="#1e65ad" strokeWidth="3" />
					{[10, 50, 80, 110, 145, 180, 220, 260, 305, 335, 350].map((x) => (
						<circle key={x} cx={x} cy={x === 10 ? 60 : x === 50 ? 48 : x === 80 ? 45 : x === 110 ? 30 : x === 145 ? 50 : x === 180 ? 54 : x === 220 ? 36 : x === 260 ? 56 : x === 305 ? 48 : x === 335 ? 38 : 50} r="3" fill="#1e65ad" />
					))}
				</svg>
			</div>

			<div className="mt-1.5 grid grid-cols-2 gap-1.5">
				<button className="rounded bg-gradient-to-b from-blue-600 to-blue-700 px-2 py-1.5 text-[16px] font-semibold text-white" type="button">
					▤ Export CSV
				</button>
				<button className="rounded bg-gradient-to-b from-steel-700 to-steel-600 px-2 py-1.5 text-[16px] font-semibold text-white" type="button">
					▬ View Reports
				</button>
			</div>
		</section>
	);
}

export default LogsPanel;
