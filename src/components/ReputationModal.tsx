"use client";

import UiIcon from "@/components/UiIcon";
import { Btn, Meter, Modal } from "@/components/ui";
import { WORKSHOP_LEVELS, rankProgress } from "@/lib/data";
import { rankTitle, t, type Locale } from "@/lib/i18n";

export default function ReputationModal({
  lang,
  rep,
  onClose,
}: {
  lang: Locale;
  rep: number;
  onClose: () => void;
}) {
  const step = rankProgress(rep);
  const titleOf = (at: number) => rankTitle(lang, at);

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col gap-3 text-[var(--brown)]">
        <h2 className="step-title text-center">{t(lang, "rep.title")}</h2>
        <p className="text-[15px] leading-relaxed">{t(lang, "rep.intro")}</p>

        <div className="flex flex-col gap-1.5 rounded-2xl bg-[#f8f2e8] p-3 text-[15px]">
          <Row label={t(lang, "rep.currentTitle")} value={titleOf(step.current.rep)} />
          <Row label={t(lang, "rep.currentRep")} value={String(rep)} />
          {step.maxed ? (
            <p className="pt-1 text-center font-semibold">{t(lang, "rep.maxed")}</p>
          ) : (
            <>
              <Row label={t(lang, "rep.nextTitle")} value={titleOf(step.next.rep)} />
              <Row label={t(lang, "rep.remaining")} value={String(step.remaining)} />
              <Meter value={step.ratio} color="#8d5a32" />
            </>
          )}
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t(lang, "rep.howTitle")}</h3>
          <How title={t(lang, "rep.howCommissionTitle")} body={t(lang, "rep.howCommission")} />
          <How title={t(lang, "rep.howFreeTitle")} body={t(lang, "rep.howFree")} />
          <How title={t(lang, "rep.howGradeTitle")} body={t(lang, "rep.howGrade")} />
          <p className="text-sm leading-relaxed">{t(lang, "rep.howMore")}</p>
          <p className="text-sm leading-relaxed">{t(lang, "rep.howSell")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{t(lang, "rep.ranksTitle")}</h3>
          <ol className="rank-list">
            {WORKSHOP_LEVELS.map((level, i) => {
              const state = i < step.index ? "done" : i === step.index ? "now" : "locked";
              const showNeed = level.rep === step.current.rep || level.rep === step.next?.rep;
              return (
                <li key={level.rep} className={`rank-row ${state}`}>
                  <span>
                    {state === "now" ? <UiIcon id="medal" className="ui-icon-sm" /> : null}{" "}
                    {titleOf(level.rep)}
                  </span>
                  {showNeed && <span className="text-sm">{t(lang, "rep.need", { n: level.rep })}</span>}
                </li>
              );
            })}
          </ol>
        </section>

        <Btn variant="cream" onClick={onClose}>
          {t(lang, "common.close")}
        </Btn>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function How({ title, body }: { title: string; body: string }) {
  return (
    <p className="text-[15px] leading-relaxed">
      <b>{title}</b>
      <br />
      {body}
    </p>
  );
}
