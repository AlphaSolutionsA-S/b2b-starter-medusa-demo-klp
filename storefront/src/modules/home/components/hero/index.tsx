"use client"

import { Github } from "@medusajs/icons"
import { Heading } from "@medusajs/ui"
import Button from "@/modules/common/components/button"
import Image from "next/image"

const Hero = () => {
  return (
    <div className=" p-6 max-w-4xl mx-auto border-b border-ui-border-base  bg-neutral-100">
      <Image
        src="/epoke_hero.png"
        alt="Hero background"
        quality={100}
        width="1017"
        height="331"
        priority
        
      />
    </div>
  )
}

export default Hero
