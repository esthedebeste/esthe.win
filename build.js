import { base32Decode, generateTOTP } from "@esthe/totp"
import * as html from "html-minifier-terser"
import { watch } from "node:fs"
import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	rm,
	stat,
	writeFile,
} from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { pathToFileURL } from "node:url"
import { renderFile } from "poggies"
import serve from "sirv-cli"

const TOTP_SECRET_URL =
	"otpauth://totp/estherware:esthe.win?secret=TX6KAUGKT732UFJPVZHGUJ4KIX7QSHCD&issuer=estherware&algorithm=SHA1&digits=6&period=30"
const TOTP_SECRET = "TX6KAUGKT732UFJPVZHGUJ4KIX7QSHCD"
const minifyShader = shader =>
	shader
		.replace(/\s*\/\/.*\n/g, "")
		.replace(/[{};]\s+/g, match => match[0])
		.replace(/\s+/g, " ")
		.replace(/\s*([=+-/*,]=?)\s*/g, (match, group1) => group1)
		.replace(/\s*\)\s*{\s*/g, "){")
const fragmentShader = minifyShader(await readFile("lib/Space.frag", "utf-8"))
const vertexShader = minifyShader(await readFile("lib/Space.vert", "utf-8"))
const LANGUAGES = ["en", "nl"]
const POGGIES_DATA = {
	fragmentShader,
	vertexShader,
	generateTOTP,
	base32Decode,
	LANGUAGES,
	TOTP_SECRET,
	TOTP_SECRET_URL,
}

async function renderPoggies(file, from, language) {
	const poggiesRendered = await renderFile(
		from,
		Object.assign(
			{
				l10n: object => object[language],
				language,
				OTHER_LANGUAGES: LANGUAGES.filter(l => l !== language),
				path: ("/" + file.replace(/^\/*/, ""))
					.replace(/\.pog$/, ".html")
					.replace(/(?:\/*index)?\.html$/, "")
					.replace(/\/*$/, ""),
			},
			POGGIES_DATA
		),
		{
			cache: false,
			name: pathToFileURL(from),
		}
	)
	const content = await html.minify(poggiesRendered, {
		caseSensitive: false,
		collapseBooleanAttributes: true,
		collapseInlineTagWhitespace: false,
		collapseWhitespace: true,
		conservativeCollapse: true,
		continueOnParseError: false,
		decodeEntities: true,
		html5: true,
		includeAutoGeneratedTags: true,
		keepClosingSlash: false,
		minifyCSS: true,
		minifyJS: {
			compress: { ecma: 2022 },
			mangle: { toplevel: true },
			format: { ecma: 2022 },
		},
		minifyURLs: true,
		noNewlinesBeforeTagClose: false,
		preserveLineBreaks: false,
		preventAttributesEscaping: false,
		processConditionalComments: false,
		quoteCharacter: '"',
		removeAttributeQuotes: true,
		removeComments: true,
		removeEmptyAttributes: false,
		removeEmptyElements: false,
		removeOptionalTags: true,
		removeRedundantAttributes: true,
		removeScriptTypeAttributes: false,
		removeStyleLinkTypeAttributes: false,
		removeTagWhitespace: false,
		sortAttributes: true,
		sortClassName: true,
		useShortDoctype: true,
	})
	return content
}

async function build() {
	await rm("dist", { recursive: true, force: true })
	await mkdir("dist", { recursive: true })
	await copyFile("node_modules/@esthe/totp/dist/index.js", "dist/totp.js")
	const htmls = []
	for (const file of await readdir("public", { recursive: true })) {
		const from = join("public", file)
		if ((await stat(from)).isDirectory()) continue
		try {
			if (!file.endsWith(".pog")) {
				const to = join("dist", file)
				await mkdir(dirname(to), { recursive: true })
				await copyFile(from, to)
				continue
			}
			for (const language of LANGUAGES) {
				const to = join("dist", language, file)
				const htmlFile = to.replace(/\.pog$/, ".html")
				const html = await renderPoggies(file, from, language)
				htmls.push(htmlFile)
				await mkdir(dirname(to), { recursive: true })
				await writeFile(htmlFile, html)
				await writeFile(
					join("dist", file.replace(/\.pog$/, ".html")),
					await renderPoggies(file, "./lib/RedirectUnlanguaged.pog", "")
				)
			}
		} catch (error) {
			console.error(error)
		}
	}
	const sitemap = htmls
		.map(path => relative(".", path).replaceAll("\\", "/"))
		.filter(f => !f.endsWith("404.html"))
		.map(f => f.replace("dist", "https://esthe.win"))
		.map(f => f.replace(/index\.html$/, "").replace(/\.html$/, ""))
		.join("\n")
	await writeFile("dist/sitemap.txt", sitemap)
	console.log("build complete")
}

if (process.argv.includes("--dev")) {
	let pbuild = null
	async function cb() {
		try {
			if (pbuild) await pbuild
			await (pbuild = build())
		} catch (e) {
			console.error(e)
		}
	}
	for (const dir of ["public", "lib"]) watch(dir, { recursive: true }, cb)
	serve("dist", { dev: true })
}

build()
