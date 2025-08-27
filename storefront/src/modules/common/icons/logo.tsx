import { SVGProps } from "react"
import Image from "next/image"

const LogoIcon = (props: SVGProps<SVGSVGElement>) => (
  <Image src="https://epoke.dk/media/images/logo_x2.gif" width={88} height={61} alt="logo" />
)

export default LogoIcon
