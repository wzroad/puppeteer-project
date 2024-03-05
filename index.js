import puppeteer from "puppeteer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
  });

  const page = await browser.newPage();

  // 豆瓣电影
  await page.goto("https://movie.douban.com/", {
    waitUntil: "networkidle2",
  });

  log("开启网站，等待 2 秒加载数据");
  await sleep(2000);

  const items = await page.$$eval("a.item", (elements) =>
    elements.map((element) => {
      return element.href.split("?")[0];
    })
  );

  if (items.length) {
    log(`找到 ${items.length} 条内容`);
  } else {
    log("没有找到任何内容");
  }

  await movieParse(page, items);
  // test
  // await movieParse(page, ["https://movie.douban.com/subject/36754326/"]);

  await browser.close();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });

function sleep(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function log(message) {
  console.log(new Date().toLocaleString(), message);
}

const keyMap = {
  导演: "director",
  编剧: "screenwriter",
  主演: "starring",
  类型: "type",
  "制片国家/地区": "area",
  语言: "language",
  上映日期: "releaseDate",
  片长: "duration",
  又名: "alias",
  IMDb: "IMDb",
  官方网站: "officialWebsite",
  首播: "firstBroadcast",
  集数: "episodes",
  单集片长: "singleEpisodeDuration",
};

export async function movieParse(page, items) {
  let count = 0;
  for (const url of items) {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    log(`到达电影详情${url}，等待1秒...`);
    await sleep(1000);
    try {
      log("开始采集电影信息...");
      const subject = {};
      subject.id = url.match(/subject\/(\d+)/)[1];
      const data = await prisma.subject.findUnique({
        where: {
          id: subject.id,
        },
      });
      if (data) {
        // 如果数据库中已经存在此条数据，则跳过
        log(`数据库中已经存在 ${url} 的数据，跳过此页...`);
        continue;
      }
      subject.url = url;
      subject.title = await page.$eval(
        "h1 span",
        (element) => element.textContent
      );
      subject.year = await page.$eval(
        "h1 .year",
        (element) => element.textContent
      );
      subject.cover = await page.$eval(".nbgnbg img", (element) => element.src);
      subject.summary = await page.$eval(
        ".related-info .indent span",
        (element) => element.textContent.replace(/\n/g, "").trim()
      );
      subject.rating = await page.$eval(
        ".rating_num",
        (element) => element.textContent
      );

      subject.pictures = (
        await page.$$eval(".related-pic-bd img", (elements) =>
          elements.map((element) => element.src)
        )
      ).join(",");

      const celes = await page.$$eval(".celebrity", (elements) =>
        elements.map((element) => {
          if (!element.querySelector("a")) {
            return;
          }
          // 优化：如果没有头像，则不保存
          const avatarElm = element.querySelector(".avatar");
          let avatar = null;
          if (avatarElm) {
            avatar = avatarElm
              .getAttribute("style")
              .match(/url\(([^)]+)\)/g)[1];
            avatar = avatar
              ? avatar.replace(/url\((['"])?(.*?)\1\)/gi, "$2")
              : null;
            if (!avatar) {
              avatar = avatarElm
                .getAttribute("style")
                .match(/url\(([^)]+)\)/g)[0];
              avatar = avatar
                ? avatar.replace(/url\((['"])?(.*?)\1\)/gi, "$2")
                : null;
            }
          }

          return {
            id: element.querySelector("a").href.match(/celebrity\/(\d+)/)[1],
            name: element.querySelector(".name").textContent,
            avatar,
            role: element.querySelector(".role").textContent,
            link: element.querySelector("a").href,
          };
        })
      );
      const celebrities = [];
      for (let index = 0; index < celes.length; index++) {
        const element = celes[index];
        if (!element) {
          continue;
        }
        const celebrity = await prisma.celebrity.findUnique({
          where: {
            id: element.id,
          },
        });
        // 如果数据库中已经存在此条数据，则跳过
        if (celebrity) {
          // subjectId 会报错,不需要保存到数据
          const { subjectId, ...cdata } = celebrity;
          celebrities.push(cdata);
          continue;
        }
        celebrities.push(element);
      }
      // 电影详细信息
      const infos = await page.evaluate(() => {
        const info = document.querySelector("#info");
        return info.textContent
          .split("\n")
          .map((e) => e.replace(/\n/g, "").trim());
      });
      for (let index = 0; index < infos.length; index++) {
        const element = infos[index];
        if (!element) {
          continue;
        }
        const kv = element.split(": ");
        // 略过季数
        if (kv[0] === "季数") {
          continue;
        }
        // 有些信息没有值
        if (kv.length < 2) {
          subject[keyMap[kv[0]]] = "未知";
          continue;
        }
        // 有些信息是链接
        if (kv[1].includes("https")) {
          log(kv[1]);
          subject[keyMap[kv[0]]] = kv[1].trim();
          continue;
        }
        // 有些信息是数组
        const valueArr = kv[1]
          .split("/")
          .map((e) => e.replace("更多...", "").trim());
        if (valueArr.length > 1) {
          subject[keyMap[kv[0]]] = valueArr.join(",");
          continue;
        }
        subject[keyMap[kv[0]]] = kv[1].trim();
      }
      log("数据采集成功，开始保存到数据库...");
      await prisma.subject.create({
        data: {
          ...subject,
          celebrity: {
            connectOrCreate: celebrities.map((e) => {
              return {
                where: {
                  id: e.id,
                },
                create: e,
              };
            }),
          },
        },
      });
      count++;
      log(`数据 ${url} 保存完成，继续采集下一条数据...`);
    } catch (error) {
      console.log(error);
      log(`在 ${url} 页发生错误: 跳过此页`);
      continue;
    }
  }
  log(`今日采集已完成，共采集 ${count} 条数据`);
}
