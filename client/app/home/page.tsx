"use client";
import HomePost from "@/components/ui/HomePost";
import LeftSide from "./aside/LeftSide";
import RightSide from "./aside/RightSide";
import { useEffect } from "react";

export default function HomePage() {

  return (
    <div className="min-h-screen bg-black">
      <main
        className="
          grid
          min-h-screen

          /* >= 1156px */
          grid-cols-[1fr_minmax(475px,680px)_1fr]

          /* 906px – 1155px */
          max-[1155px]:grid-cols-[1fr_minmax(475px,680px)]

          /* 0px – 905px */
          max-[905px]:block max-[905px]:place-items-center
        "
      >
        {/* LEFT */}
        <aside
          className="flex justify-end p-4 pr-14 max-[1155px]:hidden"
          style={{ position: "sticky", top: 0, alignSelf: "flex-start", height: "fit-content", zIndex: 100 }}
        >
          <RightSide />
        </aside>

        {/* CENTER */}
        <section
          className="
            flex justify-center
            max-[905px]:justify-center
          "
        >
          <div
            className="
              w-full min-w-[680px] max-w-[680px] mx-auto
              max-[680px]:min-w-[475px]
              max-[680px]:w-full pt-3
            "
          >
            <HomePost />
          </div>
        </section>

        {/* RIGHT */}
        <aside
          className="flex justify-start relative p-4 pl-14 max-[905px]:hidden"
          style={{ position: "sticky", top: 0, alignSelf: "flex-start", height: "fit-content", zIndex: 20 }}
        >
          <LeftSide />
        </aside>
      </main>
    </div>
  );
}
