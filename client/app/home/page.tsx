"use client";
import HomePost from "@/components/ui/HomePost";
import LeftSide from "./aside/LeftSide";
import RightSide from "./aside/RightSide";
import { useEffect, useRef, useState, useCallback } from "react";

export default function HomePage() {
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const [isBottom, setIsBottom] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const wrapper = scrollWrapperRef.current;
      if (wrapper) {
        const atBottom =
          Math.abs(wrapper.scrollTop + wrapper.clientHeight - wrapper.scrollHeight) < 5;
        setIsBottom(atBottom);
      }
    }

    const wrapper = scrollWrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (wrapper) {
        wrapper.removeEventListener("scroll", handleScroll);
      }
    };
    // We intentionally do NOT include isBottom in deps to avoid resetting due to setIsBottom itself
    // eslint-disable-next-line
  }, []);

  // Hàm để truyền cho HomePost, dùng để đổi isBottom về false
  const resetIsBottom = useCallback(() => {
    setIsBottom(false);
  }, []);

  return (
    <div
      className="flex flex-1 flex-col bg-[#202124] min-h-full items-center"
    >
      <div
        ref={scrollWrapperRef}
        className="w-full overflow-y-auto custom-scroll"
        style={{ maxHeight: "calc(100vh - 64px)" }}
      >
        <main
          className="
            grid
            w-full

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
              <HomePost isBottom={isBottom} resetIsBottom={resetIsBottom} />
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
    </div>
  );
}
