import { DviCommand, merge } from '../parser';

class SVG extends DviCommand {
  svg : string;
  
  constructor(svg) {
    super({});
    this.svg = svg;
  }  
}

async function* specialsToSVG(commands) {
  for await (const command of commands) {
    if (! command.special) {
      yield command;
    } else {
      if (! command.x.startsWith('dvisvgm:raw ')) {
	yield command;
      } else {
	let svg = command.x.replace(/^dvisvgm:raw /, '');
	yield new SVG(svg);
      }
    }
  }
}
    
export default function (commands) {
  return merge( specialsToSVG(commands),
		command => command.svg,
		function(commands) {
		  let svg = commands
		    .map( command => command.svg )
		    .join()
                    .replace(/{\?nl}/g, "\n");
		  return new SVG( svg );
		});
}
