import { Buffer } from 'buffer';
import { Machine, Rule } from "./machine";
import { Writable } from 'stream';

import * as glyphs from './tfm/encodings.json';
import * as fontlist from '../tools/fontlist.json';

export default class HTMLMachine extends Machine {
  output : Writable;
  pointsPerDviUnit : number = 0;

  svgDepth : number = 0;
  color : string = '';
  colorStack : string[] = [];

  paperwidth : number = 0;
  paperheight : number = 0;

  pageContent : string[] = [];
  lastOutputHeight : number = 0;

  lastTextV : number = 0;
  lastTextRight : number = 0;  
  
  writeToPage( content : string ) {
    this.pageContent.push( content );
    this.lastOutputHeight = this.position.v;
  }
  
  pushColor( c : string ) {
    this.colorStack.push(this.color);
    this.color = c;
  }

  popColor( ) {
    const result = this.colorStack.pop();
    if (result)
      this.color = result;
    else
      throw new Error('Popped from empty color stack');
  }

  setPapersize( width : number, height : number ) {
    this.paperwidth = width;
    this.paperheight = height;  
  }

  
  beginPage( page : any ) {
    super.beginPage(page);
    this.pageContent = [];    
  }

  endPage() {
    let height = 0;
    
    if (this.savedPosition) {
      height = Math.max( this.savedPosition.v, this.lastOutputHeight ) * this.pointsPerDviUnit;
    }
    
    this.output.write(`<div style="position: relative; width: 100%; height: ${height}pt;" class="page">`);

    for( let i = 0; i < this.pageContent.length; i++ ) {
      let x = this.pageContent[i];
      this.output.write(x);
    }
    
    this.output.write(`</div>`);
    
    this.pageContent = [];    
  }  
  
  putHTML( html : string ) {
    // ignore this for now
    if (html == '<p>')
      this.writeToPage( '<p role="text">' );      
    else
      this.writeToPage( html );
  }
  
  beginSVG( ) {
    let left = this.position.h * this.pointsPerDviUnit;
    let top = this.position.v * this.pointsPerDviUnit;

    if (this.svgDepth == 0) {
      // FIXME: Should I have 0.99624in instead of 1in ?
      this.writeToPage( `<svg width="1in" height="1in" viewBox="0 0 72 72" style="position: absolute; top: 0pt; left: 0pt; overflow: visible;">\n` );
    }
    
    this.writeToPage( `<g transform="translate(${left},${top})">\n` );
    this.svgDepth += 1;
  }

  endSVG( ) {
    this.svgDepth -= 1;

    this.writeToPage( '</g>' );
    
    if (this.svgDepth == 0) {
      this.writeToPage( '</svg>' );
    }
  }
  
  putSVG( svg : string ) {
    let left = this.position.h * this.pointsPerDviUnit;
    let top = this.position.v * this.pointsPerDviUnit;
    
    svg = svg.replace(/{\?x}/g, left.toString());
    svg = svg.replace(/{\?y}/g, top.toString());

    this.writeToPage( svg );
  }

  constructor( o : Writable ) {
    super();
    this.output = o;
    this.color = 'black';
    this.colorStack = [];
    this.svgDepth = 0;
  }

  preamble ( numerator : number, denominator : number, magnification : number, comment : string ) {
    let dviUnit = magnification * numerator / 1000.0 / denominator;
    
    let resolution = 300.0; // ppi
    let tfm_conv = (25400000.0 / numerator) * (denominator / 473628672) / 16.0;
    let conv = (numerator / 254000.0) * (resolution / denominator);
    conv = conv * (magnification / 1000.0);
    
    this.pointsPerDviUnit = dviUnit * 72.27 / 100000.0 / 2.54;
  }
  
  putRule( rule : Rule ) {
    let a = rule.a * this.pointsPerDviUnit;
    let b = rule.b * this.pointsPerDviUnit;
    let left = this.position.h * this.pointsPerDviUnit;
    let bottom = this.position.v * this.pointsPerDviUnit;
    let top = bottom - a;

    if (this.svgDepth == 0) {
      const height = `${a}pt`;
      // https://annualbeta.com/blog/1px-hairline-css-borders-on-hidpi-screens/
      this.writeToPage(`<span style="background: ${this.color}; position: absolute; top: ${top}pt; left: ${left}pt; width:${b}pt; min-width: 1px; min-height: 1px; height: ${height};"></span>\n`);
    } else {
      this.writeToPage(`<rect x="${left}" y="${top}" width="${b}" height="${a}"/>\n`);
    }
  }
    
  putText( text : Buffer ) : number {
    let textWidth = 0;
    let textHeight = 0;
    let textDepth = 0;

    var htmlText = "";
    
    for( let i = 0; i < text.length; i++ ) {
      let c = text[i];
      let metrics = this.font.metrics.characters[c];
      if (metrics === undefined)
	throw Error(`Could not find font metric for ${c}`);
      
      textWidth += metrics.width;
      textHeight = Math.max(textHeight, metrics.height);
      textDepth = Math.max(textDepth, metrics.depth);

      let encoding = fontlist['default'][this.font.name];
      /*
      if (this.font.name == 'cmmi10') {
        console.log(this.font.name, encoding, JSON.stringify(glyphs[encoding]));
      }
      */
      let codepoint = glyphs['default'][encoding][c];
      htmlText += `&#${codepoint};`;
    }
    
    // tfm is based on 1/2^16 pt units, rather than dviunit which is 10^−7 meters
    var dviUnitsPerFontUnit = this.font.metrics.designSize / 1048576.0 * 65536 / 1048576;
    
    var top = (this.position.v - textHeight * dviUnitsPerFontUnit) * this.pointsPerDviUnit;
    let left = this.position.h * this.pointsPerDviUnit;

    var width = textWidth * this.pointsPerDviUnit * dviUnitsPerFontUnit;
    var height = textHeight * this.pointsPerDviUnit * dviUnitsPerFontUnit;
    var depth = textDepth * this.pointsPerDviUnit * dviUnitsPerFontUnit;
    var top = this.position.v * this.pointsPerDviUnit;

    let fontsize = (this.font.metrics.designSize / 1048576.0) * this.font.scaleFactor / this.font.designSize;

    if (this.svgDepth == 0) {
      let space = '';
      if ((this.lastTextV == this.position.v) && (left > this.lastTextRight + 2)) {
        space = '<span style="display: inline-block; width: 0pt;">&nbsp;</span>';
      }
      
      this.writeToPage( `<span style="line-height: 0; color: ${this.color}; font-family: ${this.font.name}; font-size: ${fontsize}pt; position: absolute; top: ${top - height}pt; left: ${left}pt; overflow: visible;"><span style="margin-top: -${fontsize}pt; line-height: ${0}pt; height: ${fontsize}pt; display: inline-block; vertical-align: baseline; ">${space}${htmlText}</span><span style="display: inline-block; vertical-align: ${height}pt; height: ${0}pt; line-height: 0;"></span></span>\n` );
      this.lastTextV = this.position.v;
      this.lastTextRight = left + width;
    } else {
      let bottom = this.position.v * this.pointsPerDviUnit;
      // No 'pt' on fontsize since those units are potentially scaled
      this.writeToPage( `<text alignment-baseline="baseline" y="${bottom}" x="${left}" style="font-family: ${this.font.name};" font-size="${fontsize}">${htmlText}</text>\n` );
    }
    
    return textWidth * dviUnitsPerFontUnit * this.font.scaleFactor / this.font.designSize;
  }
}

