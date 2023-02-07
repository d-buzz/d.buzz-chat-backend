import md from 'markdown-ast';

const URL_ABSOLUTE_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i; 
const URL_IMG_RE = /\.(jpeg|jpg|gif|png|webp)$/;
const GL_URL_HTTP = true;
const GL_HTTP_TO_HTTPS = true;
export class Markdown {
    static imgPrepend:string = "";
	static simpleFilteredURL(url) {
		var r = {
			url: "",
			protocol: "",
			image: false
		};
		if(URL_ABSOLUTE_RE.test(url)) {
			try {
				var u = new URL(url);
				r.protocol = u.protocol;	
				if(u.protocol === "http:") { //optionally upgrade to https
					if(GL_HTTP_TO_HTTPS) {
						r.url = "https://"+u.href.substring(5);
						r.protocol = "https:";
					}
					else if(GL_URL_HTTP) r.url = u.href;
					r.image = URL_IMG_RE.test(u.pathname);
				}
				else if(u.protocol === "https:") { 
					r.url = u.href;
					r.image = URL_IMG_RE.test(u.pathname);
				} 
				if(u.protocol === "mailto:") r.url = u.href;
			}
			catch(e) { console.log(e); }
			return r;
		}
		else {
			return r;
		}
	}
    static simpleHtml(html) {
		/*var result = document.createDocumentFragment();
		var arr = window.htmlAst(html);
		console.log(arr);
		simpleHtml0(arr, result);
		return result;*/ return null;
	}
    static simpleMarkdownTextAdd2(text, result) {
		var lines = text.split(/\n/);
		for(var i = 0; i < lines.length; i++) {
			var line = lines[i];
			if(i !== 0) result.appendChild(document.createElement("br"));
			var words = line.split(/\s+/);
			
			var str = "";
			for(var j = 0; j < words.length; j++) {
				var word = words[j];
				
				if(word.startsWith("@")) {
					result.appendChild(document.createTextNode(str)); str = " ";
					var linkA = document.createElement("a");
					linkA.setAttribute("href", "/#"+word);
					linkA.innerText = word;
					result.appendChild(linkA);
				}
				else if(word.startsWith("https://") || word.startsWith("http://")) {
					result.appendChild(document.createTextNode(str)); str = " ";
					var u = Markdown.simpleFilteredURL(word);
					if(u.image) {
						var linkImg = document.createElement("img");
						linkImg.setAttribute("src", Markdown.imgPrepend+u.url);
						linkImg.innerText = word;
						result.appendChild(linkImg);
					}
					else {
						var linkA = document.createElement("a");
						linkA.setAttribute("href", u.url);
						linkA.setAttribute("rel", "noopener noreferrer");
						linkA.setAttribute("target", "_blank");
						linkA.innerText = word;
						result.appendChild(linkA);
					}
				}
				else str += word+" ";
			}
			result.appendChild(document.createTextNode(str));
		}
        return result;
	}
	static simpleMarkdownTextAdd(text, html) {
        html = false;
		var result = (html)?Markdown.simpleHtml(text):Markdown.simpleMarkdownTextAdd2(text, document.createDocumentFragment());
		return result;
	}
	static simpleMarkdownAdd(arr, result, level) {
		var html = true;
		var lastType = "";
		var lastP = null;
		for(var i = 0; i < arr.length; i++) {
			var a = arr[i];
			var item = null;
			var addP = true;
			switch(a.type) {
				case "image":
					item = document.createElement("img");
					item.setAttribute("alt", a.alt);
					item.setAttribute("src", Markdown.imgPrepend+a.url);
					break;	
				case "italic": item = document.createElement("i"); break;
				case "bold": item = document.createElement("b"); break;
				case "strike": item = document.createElement("del"); break;
				case "codeSpan": 
					item = document.createElement("code"); 
					item.innerText = a.code;
					break;
				case "link":
					item = document.createElement("a");
					//item.setAttribute("rel", a.rel);
					item.setAttribute("href", a.url);
					break;
				case "break": addP = false; 
					/*if(lastType != "bold" && lastType != "italic" && lastType != "text" && lastType != "title" && lastType != "quote")*/
					//if(lastP === null || !lastP.__skipBreak)
					if(level > 0)
						item = document.createElement("br");
					break;
				case "codeBlock": addP = false;
					var pre = document.createElement("pre"); 
					var code = document.createElement("code"); 
					code.innerText = a.code;
					pre.appendChild(code);
					result.appendChild(pre);
					break;
				case "text": 
					if(lastP !== null) {
						item = Markdown.simpleMarkdownTextAdd(a.text, html); //document.createTextNode(a.text);
					}
					else {
						if(level === 0) {
							addP = false;
							item = document.createElement("p");
							lastP = item;
							if(a.text !== undefined) { 
								item.appendChild(Markdown.simpleMarkdownTextAdd(a.text.trimLeft(), html));
								//item.innerText = a.text.trimLeft();
							}  
						}
						else item = Markdown.simpleMarkdownTextAdd(a.text, html);
					}
					//item = document.createElement("p");
					//if(a.text !== undefined) { item.innerText = a.text.trim(); }  
					
					/*if(level === 0) {
						item = document.createElement("p");
						if(a.text !== undefined) { item.innerText = a.text.trim(); }  
					}
					else {
						item = document.createTextNode(a.text.trim());
					}*/
					
					/*if(a.text == "\n") {
						if(level !== 0) item = document.createElement("br");
					}
					else if(level === 0) {
						item = document.createElement("p");
						if(a.text !== undefined) { item.innerText = a.text.trim(); }  
					}
					else {
						item = document.createTextNode(a.text.trim());
					}*/
					break;
				case "title": addP = false; item = document.createElement("h"+a.rank); break;
				case "quote": addP = false; item = document.createElement("blockquote"); break;
				case "list": addP = false;
					var d = document.createElement("div");
					d.setAttribute("class", "md-list");
					d.appendChild(document.createTextNode(a.bullet));
					var d2 = document.createElement("span");
					d.appendChild(d2);
					result.appendChild(d);
					Markdown.simpleMarkdownAdd(a.block, d2, level+1);
					break;
				// border linkDef
				default:
					console.log("unknown " + a.type);
					console.log(a);
					break;
			}
			if(item !== lastP && !addP) lastP = null;
			lastType = a.type;
			if(item !== null) {
				if(level === 0 && addP && lastP === null) {
					lastP = document.createElement("p");
					lastP.__skipBreak = true;
					result.appendChild(lastP);
				}
				((lastP!==null&&addP)?lastP:result).appendChild(item);
				if(a.block != null) {
					Markdown.simpleMarkdownAdd(a.block, item, level+1);
				} 
			}
		}
	}
	static simpleMarkdownPreviewText(arr, maxSize=100000) {
		var lastType = "";
		var str = "";
		for(var i = 0; i < arr.length; i++) {
			var a = arr[i];
			if(a.code != null) str += a.code; 
			if(a.type === "break") { if(lastType !== "break" && str.length > 0 && str[str.length-1] !== ' ') str += " "; }
			else if(a.text != null) { str += a.text;	}
			if(a.block != null && str.length < maxSize) str += Markdown.simpleMarkdownPreviewText(a.block, maxSize-str.length);
			if(str.length > maxSize) return str.substring(0, maxSize);
			lastType = a.type;
		}
		return str;
	}
    static markdown(text) { return md(text); }
	static simpleMarkdown(text,result = null) {
		var ast = Markdown.markdown(text);
		var doc = document.createDocumentFragment();
		Markdown.simpleMarkdownAdd(ast, doc, 0);
		if(result) result.appendChild(doc);
        return doc;
	}
}


