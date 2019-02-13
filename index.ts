import * as fs from "fs";
import { execSync } from "child_process";
import { dviParser } from "./src/parser";

let fonts = "";
fonts = fonts + `@font-face { font-family: esint10; src: url('./esint10.ttf'); }\n`;
fs.readdirSync('./bakoma/ttf').forEach(file => {
  let name = file.replace(/.ttf/, '');
  fonts = fonts + `@font-face { font-family: ${name}; src: url('bakoma/ttf/${file}'); }\n`;
});
fs.writeFileSync("fonts.css", fonts);

//execSync("latex sample/sample.tex");

let filename = 'sample.dvi';

let stream = fs.createReadStream(filename,
				 { highWaterMark: 256 });

let html = "";
html = html + "<html>\n";
html = html + "<head>\n";
html = html + '<link rel="stylesheet" type="text/css" href="fonts.css">\n';
html = html + '<link rel="stylesheet" type="text/css" href="base.css">\n';
html = html + "</head>\n";
html = html + '<body>\n';
html = html + '<div style="position: absolute;">\n';

//html = html + dviParser( buffer );

let parser = dviParser(stream);

async function main() {
    for await (const chunk of parser) {
      console.log(chunk);
    }
}
main()

// emits each line as a buffer or as a string representing an array of fields
//parser.on('data', function (line) {
//  console.log(line)
//})
//stream.pipe( parser );

html = html + '</div>\n';
html = html + '</body>\n';
html = html + "</html>\n";

fs.writeFileSync("index.html", html);
