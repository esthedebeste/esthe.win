import { generateTOTP } from "@esthe/totp"
import * as html from "html-minifier-terser"
import { watch } from "node:fs"
import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	stat,
	writeFile,
} from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { pathToFileURL } from "node:url"
import { renderFile } from "poggies"
import serve from "sirv-cli"

const TOTP_SECRET = "very-secret-totp-passcode"
const minifyShader = shader =>
	shader.replace(/\s*\/\/.*\n/g, "").replace(/[{};]\s+/g, match => match[0])
const fragmentShader = minifyShader(await readFile("lib/Space.frag", "utf-8"))
const vertexShader = minifyShader(await readFile("lib/Space.vert", "utf-8"))
const POGGIES_DATA = {
	fragmentShader,
	vertexShader,
	generateTOTP,
	TOTP_SECRET,
}

async function build() {
	const htmls = []
	for (const file of await readdir("public", { recursive: true })) {
		const from = join("public", file)
		if ((await stat(from)).isDirectory()) continue
		const to = join("dist", file)
		try {
			mkdir(dirname(to), { recursive: true })
			if (!file.endsWith(".pog")) {
				await copyFile(from, to)
				continue
			}
			const content = await html.minify(
				await renderFile(from, POGGIES_DATA, {
					cache: false,
					name: pathToFileURL(from),
				}),
				{
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
				}
			)
			const htmlFile = to.replace(/\.pog$/, ".html")
			htmls.push(htmlFile)
			await writeFile(htmlFile, content)
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

await mkdir("dist", { recursive: true })
await copyFile("node_modules/@esthe/totp/dist/index.js", "dist/totp.js")
if (process.argv.includes("--dev")) {
	watch("public", { recursive: true }, () => build())
	serve("dist", { dev: true })
}

build()