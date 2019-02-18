import color from "./specials/color";
import svg from "./specials/svg";
import papersize from "./specials/papersize";

import HTMLMachine from "./html";
import TextMachine from "./text";

export var Machines = { HTML: HTMLMachine,
			text: TextMachine };

import { dviParser, execute, mergeText } from "./parser";
export { dviParser, execute, mergeText };

export var specials = {
  color: color,
  svg: svg,
  papersize: papersize
};


