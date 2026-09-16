import type { JSONContent } from '@tiptap/core'
import type { Notebook, Note } from '../types'

const text = (value: string): JSONContent => ({ type: 'text', text: value })
const p = (value: string): JSONContent => ({ type: 'paragraph', content: [text(value)] })
const h = (value: string): JSONContent => ({ type: 'heading', attrs: { level: 2 }, content: [text(value)] })
const code = (language: string, value: string): JSONContent => ({ type: 'codeBlock', attrs: { language }, content: [text(value)] })
const list = (items: string[]): JSONContent => ({
  type: 'orderedList', attrs: { start: 1 }, content: items.map(value => ({ type: 'listItem', content: [p(value)] })),
})
const table = (rows: string[][]): JSONContent => ({
  type: 'table', content: rows.map((row, index) => ({
    type: 'tableRow', content: row.map(value => ({
      type: index === 0 ? 'tableHeader' : 'tableCell',
      attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(value)],
    })),
  })),
})
const link = (label: string, href: string): JSONContent => ({
  type: 'paragraph', content: [{ type: 'text', text: label, marks: [{ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }] }],
})
const categoryIds = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004']
const created = '2026-09-16T00:00:00.000Z'
function note(index: number, title: string, slug: string, category: number, content: JSONContent[]): Note {
  return {
    id: `20000000-0000-4000-8000-00000000000${index}`,
    title, slug, category_id: categoryIds[category], published: true,
    content: { type: 'doc', content }, content_html: '', created_at: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
    updated_at: `2026-09-${String(17 - index).padStart(2, '0')}T00:00:00.000Z`,
  }
}

export const seed: Notebook = {
  categories: ['JAVA', '数据库', '嵌入式', '设计模式'].map((name, index) => ({
    id: categoryIds[index], name, slug: ['java', 'database', 'embedded', 'design-pattern'][index],
    sort_order: index, created_at: created,
  })),
  notes: [
    note(1, 'JavaSE - Java入门', 'java-getting-started', 0, [
      p('从一个最小的 Java 程序开始，理解源文件、编译器与运行环境的关系。这篇笔记整理第一次运行程序时需要关注的几个概念。'),
      h('01 · 从 Hello, Java 开始'),
      p('将下面的程序放入 HelloNote.java。文件名与 public 类名保持一致；main 方法是这个程序的入口。'),
      code('java', 'public class HelloNote {\n    public static void main(String[] args) {\n        String topic = "Java";\n        int days = 7;\n\n        System.out.println("Hello, " + topic);\n        System.out.println("Learning for " + days + " days.");\n    }\n}'),
      h('02 · 编译与运行'),
      list(['编写源文件：使用 .java 扩展名保存代码。', '执行 javac HelloNote.java，将源代码编译为字节码。', '执行 java HelloNote，由 JVM 加载并运行程序。']),
      { type: 'image', attrs: { src: '/images/java-workflow.png', alt: 'Java 源文件经过 javac 编译为字节码，再由 JVM 运行的流程图', title: 'Java 程序的编译与运行' } },
      h('03 · 三个常用概念'),
      table([['概念', '作用', '本例中的位置'], ['JDK', '提供开发与编译工具', 'javac 命令'], ['字节码', '编译后交给虚拟机执行的指令', 'HelloNote.class'], ['JVM', '加载与执行字节码', 'java 命令启动的运行环境']]),
      { type: 'blockquote', content: [p('先确保一个小程序能够运行，再逐步加入变量、条件与循环。每次只引入一个新概念，更容易定位问题。')] },
      h('04 · 延伸阅读'),
      link('Oracle Java 学习资料', 'https://dev.java/learn/'),
    ]),
    note(2, 'JavaSE - 常见错误', 'java-common-errors', 0, [
      p('编译错误与运行时错误发生在不同阶段。先读错误信息中的文件名和行号，再检查最小的相关代码范围。'),
      h('先判断错误发生在哪个阶段'),
      table([['错误', '发生阶段', '检查方向'], ['cannot find symbol', '编译', '变量名与作用域'], ['NullPointerException', '运行', '对象是否为 null'], ['ArrayIndexOutOfBoundsException', '运行', '数组下标范围']]),
      h('数组下标从零开始'),
      code('java', 'int[] scores = {80, 92, 88};\nfor (int i = 0; i < scores.length; i++) {\n    System.out.println(scores[i]);\n}'),
      h('一个简单的排查顺序'),
      list(['保留完整错误信息，定位第一条与自己代码相关的堆栈。', '用固定输入复现错误，缩小问题范围。', '修改后重新运行，并补充边界情况。']),
      link('Java API 文档', 'https://docs.oracle.com/en/java/'),
    ]),
    note(3, 'SQL - 查询与筛选', 'sql-select-basics', 1, [
      p('用一张学习记录表，练习选择字段、筛选条件和排序。下面的 SQL 只用于说明查询结构，不依赖本站数据库。'),
      h('选择需要的列'),
      code('sql', "SELECT title, study_minutes\nFROM learning_log\nWHERE category = 'Java'\n  AND study_minutes >= 30\nORDER BY study_minutes DESC;"),
      h('读懂查询结构'),
      table([['子句', '关注的问题'], ['SELECT', '要返回哪些字段？'], ['FROM', '从哪张表读取？'], ['WHERE', '哪些记录符合条件？'], ['ORDER BY', '结果按什么顺序展示？']]),
      h('验证结果'),
      list(['先查看少量原始记录。', '逐个添加筛选条件，观察结果变化。', '检查空值和重复值是否符合预期。']),
      link('PostgreSQL SELECT 文档', 'https://www.postgresql.org/docs/current/sql-select.html'),
    ]),
    note(4, 'C / C++ - 数组与边界', 'c-array-boundaries', 2, [
      p('嵌入式程序经常处理固定长度的数据。把缓冲区容量和有效数据长度分开考虑，可以让边界检查更加明确。'),
      h('C：遍历固定长度数组'),
      code('c', '#include <stddef.h>\n#include <stdio.h>\n\nint main(void) {\n    int samples[] = {12, 18, 24};\n    size_t count = sizeof(samples) / sizeof(samples[0]);\n    for (size_t i = 0; i < count; ++i) {\n        printf("%d\\n", samples[i]);\n    }\n    return 0;\n}'),
      h('C++：使用标准容器'),
      code('cpp', '#include <array>\n#include <iostream>\n\nint main() {\n    std::array<int, 3> samples{12, 18, 24};\n    for (int value : samples) {\n        std::cout << value << "\\n";\n    }\n}'),
      h('需要留意的边界'),
      list(['数组容量不是最后一个有效下标。', '传入函数的指针通常不包含数组长度信息。', '处理外部输入时，先检查长度再写入缓冲区。']),
    ]),
    note(5, '设计模式 - 策略模式', 'strategy-pattern', 3, [
      p('当同一项操作有多种可替换的实现时，可以将变化的部分放入独立策略中。这里用两种文字格式化方式说明结构。'),
      h('定义策略接口'),
      code('java', 'interface TextStyle {\n    String format(String text);\n}\n\nclass UppercaseStyle implements TextStyle {\n    public String format(String text) {\n        return text.toUpperCase(java.util.Locale.ROOT);\n    }\n}'),
      h('让调用方依赖接口'),
      code('java', 'class NotePrinter {\n    private final TextStyle style;\n\n    NotePrinter(TextStyle style) {\n        this.style = style;\n    }\n\n    String print(String title) {\n        return style.format(title);\n    }\n}'),
      h('适用与取舍'),
      table([['适合', '需要权衡'], ['同一个操作有多种可替换实现', '类型与对象的数量会增加'], ['希望独立测试每种算法', '简单的条件分支未必需要模式']]),
      { type: 'blockquote', content: [p('模式服务于实际变化，不必为了使用模式而增加抽象。')] },
    ]),
  ],
}
