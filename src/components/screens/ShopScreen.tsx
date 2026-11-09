"use client";

import { useState } from "react";
import { Btn, Coin, Modal, TopBar } from "@/components/ui";
import { NacreSwatch } from "@/components/MotifIcon";
import { MATERIAL_LIST, PEARL_LIST, type MaterialId } from "@/lib/data";
import { materialDesc, materialName, t } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

const pearlOf = (m: MaterialId) => PEARL_LIST.find((p) => p.material === m)?.id;

export default function ShopScreen() {
  const back = useUI((s) => s.back);
  const inventory = useSave((s) => s.inventory);
  const money = useSave((s) => s.money);
  const buy = useSave((s) => s.buy);
  const redeemCoupon = useSave((s) => s.redeemCoupon);
  const lang = useSave((s) => s.lang);
  const [flash, setFlash] = useState<string | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const submitCoupon = () => {
    const result = redeemCoupon(couponCode);
    if (result === "ok") {
      sfx.coin();
      setCouponMsg(null);
      setCouponOpen(false);
      setCouponCode("");
      setFlash(t(lang, "shop.couponOk", { n: 1911 }));
      setTimeout(() => setFlash(null), 1400);
      return;
    }
    sfx.fail();
    setCouponMsg(t(lang, result === "used" ? "shop.couponUsed" : "shop.couponBad"));
  };

  return (
    <div className="screen">
      <TopBar title={t(lang, "shop.title")} onBack={back} />
      <div className="screen-body">
        <div className="shop-sign">
          <span className="text-3xl">🏮</span>
          <div>
            <b className="text-lg">{t(lang, "shop.sign")}</b>
            <div className="text-sm opacity-80">{t(lang, "shop.signSub")}</div>
          </div>
        </div>
        <Btn
          variant="lavender"
          onClick={() => {
            setCouponMsg(null);
            setCouponOpen(true);
          }}
        >
          {t(lang, "shop.coupon")}
        </Btn>
        {MATERIAL_LIST.map((m) => (
          <div key={m.id} className="panel flex items-center gap-3 py-3">
            {pearlOf(m.id) ? (
              <NacreSwatch pearl={pearlOf(m.id)!} round={false} className="mat-icon nacre" />
            ) : (
              <div className="mat-icon">{m.emoji}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <b className="text-[var(--brown)]">{materialName(lang, m.id)}</b>
                <span className="text-xs opacity-70">{t(lang, "shop.owned", { n: inventory[m.id] })}</span>
              </div>
              <div className="text-xs opacity-80">{materialDesc(lang, m.id)}</div>
            </div>
            <Btn
              size="sm"
              variant="gold"
              sound={false}
              disabled={money < m.price}
              onClick={() => {
                if (buy(m.id)) {
                  sfx.coin();
                  setFlash(`${materialName(lang, m.id)} ${t(lang, "shop.buy")}`);
                  setTimeout(() => setFlash(null), 900);
                }
              }}
            >
              <Coin /> {m.price}
            </Btn>
          </div>
        ))}

        <div className="panel flex flex-col gap-2 py-3 opacity-90">
          <b className="text-[var(--brown)]">{t(lang, "shop.iap")}</b>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              [t(lang, "shop.iapPack1"), 500, "₩1,200"],
              [t(lang, "shop.iapPack2"), 1500, "₩3,300"],
              [t(lang, "shop.iapPack3"), 5000, "₩9,900"],
            ].map(([n, c, p]) => (
              <div key={n as string} className="iap-card">
                <div className="text-2xl">🪙</div>
                <div>{n}</div>
                <div className="text-xs">
                  <Coin /> {c}
                </div>
                <div className="mt-1 rounded-full bg-[#e8dccb] px-2 text-xs">{p}</div>
              </div>
            ))}
          </div>
          <div className="text-xs opacity-70">{t(lang, "shop.iapNote")}</div>
        </div>
      </div>
      {flash && (
        <div className="score-toast-wrap pointer-events-none">
          <div className="event-toast static pop-in">{flash}</div>
        </div>
      )}
      {couponOpen && (
        <Modal onClose={() => setCouponOpen(false)}>
          <div className="flex flex-col gap-3 text-[var(--brown)]">
            <h3 className="step-title text-center">{t(lang, "shop.couponTitle")}</h3>
            <p className="text-center text-sm opacity-80">{t(lang, "shop.couponHint")}</p>
            <input
              className="w-full rounded-2xl border-2 border-[var(--line-deep)] bg-[#fffdf8] px-4 py-3 text-center tracking-wider outline-none focus:border-[var(--gold-deep)]"
              placeholder={t(lang, "shop.couponPlaceholder")}
              value={couponCode}
              autoFocus
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => setCouponCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCoupon();
              }}
            />
            {couponMsg && <div className="text-center text-sm text-[var(--red)]">{couponMsg}</div>}
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="cream" onClick={() => setCouponOpen(false)}>
                {t(lang, "common.cancel")}
              </Btn>
              <Btn variant="gold" sound={false} disabled={!couponCode.trim()} onClick={submitCoupon}>
                {t(lang, "shop.couponUse")}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
