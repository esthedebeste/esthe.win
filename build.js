import { watch } from "node:fs"
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { renderFile } from "poggies"
import serve from "sirv-cli"

async function build() {
	for (const file of await readdir("public", { recursive: true })) {
		const from = join("public", file)
		const to = join("dist", file)
		try {
			mkdir(dirname(to), { recursive: true })
			if (!file.endsWith(".pog")) {
				await copyFile(from, to)
				continue
			}
			const content = await renderFile(from, {}, { cache: false })
			const htmlFile = to.replace(/\.pog$/, ".html")
			await writeFile(htmlFile, content)
		} catch (error) {
			console.error(error)
		}
	}
	console.log("build complete")
}

await mkdir("dist", { recursive: true })
if (process.argv.includes("--dev")) {
	watch("public", { recursive: true }, () => build())
	serve("dist", { dev: true })
}

build()
