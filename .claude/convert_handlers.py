#!/usr/bin/env python3
"""
Convert inline event handlers in JS template strings to data-action delegation pattern.
"""
import re
import sys

def convert_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    changes = 0

    # ============================================================
    # Pattern 1: Simple onclick="module.method('${arg}')"
    # Convert to: data-action="module.method" data-id="${arg}"
    # ============================================================

    # Pattern 1a: onclick="module.method('${expr}')" with single template arg
    def replace_onclick_single(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-action="{module_method}" data-id="{arg}"'

    # onclick="module.method('${...}')"
    content = re.sub(
        r'(\s)onclick="(\w+\.\w+)\(\'\$\{([^}]+)\}\'\)"',
        replace_onclick_single,
        content
    )

    # Pattern 1b: onclick="module.method('${expr}', '${expr}')" with two template args
    def replace_onclick_two(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg1 = m.group(3)
        arg2 = m.group(4)
        changes += 1
        return f"""{prefix}data-action="{module_method}" data-args='${{JSON.stringify([{arg1}, {arg2}])}}'"""

    content = re.sub(
        r'(\s)onclick="(\w+\.\w+)\(\'\$\{([^}]+)\}\',\s*\'\$\{([^}]+)\}\'\)"',
        replace_onclick_two,
        content
    )

    # Pattern 1c: onclick="module.method('${expr}', '${expr}', '${expr}')" with three template args
    def replace_onclick_three(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg1 = m.group(3)
        arg2 = m.group(4)
        arg3 = m.group(5)
        changes += 1
        return f"""{prefix}data-action="{module_method}" data-args='${{JSON.stringify([{arg1}, {arg2}, {arg3}])}}'"""

    content = re.sub(
        r'(\s)onclick="(\w+\.\w+)\(\'\$\{([^}]+)\}\',\s*\'\$\{([^}]+)\}\',\s*\'\$\{([^}]+)\}\'\)"',
        replace_onclick_three,
        content
    )

    # Pattern 2: onclick="module.method('literal', 'literal')" (no template literals - static args)
    # e.g. onclick="module.method('published')"
    # Already handled by pattern 1 for template args, but need static args too
    # onclick="module.method('${id}', 'static')"
    def replace_onclick_id_static(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg1 = m.group(3)
        static_val = m.group(4)
        changes += 1
        return f"""{prefix}data-action="{module_method}" data-args='${{JSON.stringify([{arg1}, "{static_val}"])}}'"""

    content = re.sub(
        r'(\s)onclick="(\w+\.\w+)\(\'\$\{([^}]+)\}\',\s*\'([^\'$]+)\'\)"',
        replace_onclick_id_static,
        content
    )

    # Pattern 3: onchange with this.value -> data-on-change
    # onchange="module.method('${id}', this.value)"
    def replace_onchange_this_value(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-on-change="{module_method}" data-id="{arg}"'

    content = re.sub(
        r'(\s)onchange="(\w+\.\w+)\(\'\$\{([^}]+)\}\',\s*this\.value\)"',
        replace_onchange_this_value,
        content
    )

    # Pattern 3b: onchange="module.method('${id}')" (no this.value)
    def replace_onchange_single(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-on-change="{module_method}" data-id="{arg}"'

    content = re.sub(
        r'(\s)onchange="(\w+\.\w+)\(\'\$\{([^}]+)\}\'\)"',
        replace_onchange_single,
        content
    )

    # Pattern 3c: onchange="module.method()" (no args)
    def replace_onchange_noargs(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        changes += 1
        return f'{prefix}data-on-change="{module_method}"'

    content = re.sub(
        r'(\s)onchange="(\w+\.\w+)\(\)"',
        replace_onchange_noargs,
        content
    )

    # Pattern 3d: onchange="module.method(parseInt(this.value))" -> data-on-change (registry passes el.value)
    def replace_onchange_parseint(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        changes += 1
        return f'{prefix}data-on-change="{module_method}"'

    content = re.sub(
        r'(\s)onchange="(\w+\.\w+)\(parseInt\(this\.value\)\)"',
        replace_onchange_parseint,
        content
    )

    # Pattern 3e: onchange="module.method(${idx}, this.value)" -> data-on-change with data-id
    def replace_onchange_idx_thisvalue(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-on-change="{module_method}" data-id="${{{arg}}}"'

    content = re.sub(
        r'(\s)onchange="(\w+\.\w+)\(\$\{([^}]+)\},\s*this\.value\)"',
        replace_onchange_idx_thisvalue,
        content
    )

    # Pattern 3f: onchange="module.method('${id}', this.checked)" -> data-on-check
    def replace_onchange_checked(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-on-check="{module_method}" data-id="{arg}"'

    content = re.sub(
        r'(\s)onchange="(\w+\.\w+)\(\'\$\{([^}]+)\}\',\s*this\.checked\)"',
        replace_onchange_checked,
        content
    )

    # Pattern 4: onchange with file input -> data-on-file-change
    # onchange="module.method('${id}', this)"
    def replace_onchange_file(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-on-file-change="{module_method}" data-id="{arg}"'

    content = re.sub(
        r'(\s)onchange="(\w+\.\w+)\(\'\$\{([^}]+)\}\',\s*this\)"',
        replace_onchange_file,
        content
    )

    # Pattern 5: oninput="module.method()" -> data-on-input
    def replace_oninput_noargs(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        changes += 1
        return f'{prefix}data-on-input="{module_method}"'

    content = re.sub(
        r'(\s)oninput="(\w+\.\w+)\(\)"',
        replace_oninput_noargs,
        content
    )

    # Pattern 6: onkeydown with Enter key check
    # onkeydown="if(event.key==='Enter'){event.preventDefault();module.method('${id}');}"
    def replace_onkeydown_enter(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-on-keyenter="{module_method}" data-id="{arg}"'

    content = re.sub(
        r'''(\s)onkeydown="if\(event\.key==='Enter'\)\{event\.preventDefault\(\);(\w+\.\w+)\('\$\{([^}]+)\}'\);\}"''',
        replace_onkeydown_enter,
        content
    )

    # Also handle variant without preventDefault
    content = re.sub(
        r'''(\s)onkeydown="if\(event\.key==='Enter'\)(\w+\.\w+)\('\$\{([^}]+)\}'\);"''',
        lambda m: f'{m.group(1)}data-on-keyenter="{m.group(2)}" data-id="${{{m.group(3)}}}"',
        content
    )

    # Pattern 6b: onkeydown with Enter and Escape - complex handler
    # onkeydown="if(event.key==='Enter')mod.method1('a','b');if(event.key==='Escape')mod.method2(this,'c');"
    def replace_onkeydown_enter_escape(m):
        nonlocal changes
        prefix = m.group(1) or ''
        enter_method = m.group(2)
        enter_args_raw = m.group(3)
        escape_method = m.group(4)
        escape_args_raw = m.group(5)
        changes += 1
        # Parse enter args
        enter_args = re.findall(r"'\$\{([^}]+)\}'", enter_args_raw)
        escape_args = re.findall(r"'\$\{([^}]+)\}'", escape_args_raw)
        result = f'{prefix}data-on-keyenter="{enter_method}"'
        if enter_args:
            if len(enter_args) == 1:
                result += f' data-id="${{{enter_args[0]}}}"'
            else:
                args_str = ', '.join(enter_args)
                result += f""" data-args='${{JSON.stringify([{args_str}])}}'"""
        result += f' data-on-keyescape="{escape_method}"'
        return result

    content = re.sub(
        r"""(\s)onkeydown="if\(event\.key==='Enter'\)(\w+\.\w+)\(([^)]+)\);if\(event\.key==='Escape'\)(\w+\.\w+)\(([^)]+)\);?" """,
        replace_onkeydown_enter_escape,
        content
    )

    # Pattern 7: ondblclick="module.method('${a}', '${b}', '${c}', this)"
    def replace_ondblclick(m):
        nonlocal changes
        prefix = m.group(1) or ''
        full = m.group(0)
        module_method_match = re.search(r'ondblclick="(\w+\.\w+)\(', full)
        if not module_method_match:
            return full
        module_method = module_method_match.group(1)
        # Extract args
        args_str = full[full.index('(')+1:full.rindex(')')]
        template_args = re.findall(r"'\$\{([^}]+)\}'", args_str)
        changes += 1
        if not template_args:
            return f'{prefix}data-on-dblclick="{module_method}"'
        elif len(template_args) == 1:
            return f'{prefix}data-on-dblclick="{module_method}" data-id="${{{template_args[0]}}}"'
        else:
            args_joined = ', '.join(template_args)
            return f"""{prefix}data-on-dblclick="{module_method}" data-args='${{JSON.stringify([{args_joined}])}}'"""

    content = re.sub(
        r'''(\s)ondblclick="(\w+\.\w+)\([^"]*\)"''',
        replace_ondblclick,
        content
    )

    # Pattern 8: onclick="event.preventDefault(); ..." with module call
    def replace_onclick_prevent(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg = m.group(3)
        changes += 1
        return f'{prefix}data-action="{module_method}" data-id="{arg}" data-prevent-default="true"'

    content = re.sub(
        r'(\s)onclick="event\.preventDefault\(\);\s*(\w+\.\w+)\(\'\$\{([^}]+)\}\'\)"',
        replace_onclick_prevent,
        content
    )

    # Pattern 8b: onclick="event.preventDefault(); module.method('${a}', '${b}')"
    def replace_onclick_prevent_two(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg1 = m.group(3)
        arg2 = m.group(4)
        changes += 1
        return f"""{prefix}data-action="{module_method}" data-args='${{JSON.stringify([{arg1}, {arg2}])}}' data-prevent-default="true\""""

    content = re.sub(
        r'(\s)onclick="event\.preventDefault\(\);\s*(\w+\.\w+)\(\'\$\{([^}]+)\}\',\s*\'\$\{([^}]+)\}\'\)"',
        replace_onclick_prevent_two,
        content
    )

    # Pattern 9: onclick with string concatenation (older style)
    # onclick="module.method(\''+id+'\',\''+val+'\')"
    def replace_onclick_concat_two(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        arg1 = m.group(3)
        arg2 = m.group(4)
        changes += 1
        return f"""{prefix}data-action="{module_method}" data-args='["'+{arg1}+'","'+{arg2}+'"]'"""

    content = re.sub(
        r"""(\s)onclick="(\w+\.\w+)\(\\''\+(\w+)\+'\\'[, ]*\\''\+(\w+)\+'\\'\)""",
        replace_onclick_concat_two,
        content
    )

    # Pattern 9b: onclick="module.method(\''+var1+'\',\''+var2+'\',true)"
    # etc - string concatenation patterns

    # Pattern 10: Simple onclick with no args
    # onclick="module.method()"
    def replace_onclick_noargs(m):
        nonlocal changes
        prefix = m.group(1) or ''
        module_method = m.group(2)
        changes += 1
        return f'{prefix}data-action="{module_method}"'

    content = re.sub(
        r'(\s)onclick="(\w+\.\w+)\(\)"',
        replace_onclick_noargs,
        content
    )

    with open(filepath, 'w') as f:
        f.write(content)

    return changes

if __name__ == '__main__':
    files = sys.argv[1:]
    total = 0
    for f in files:
        n = convert_file(f)
        print(f'{f}: {n} conversions')
        total += n
    print(f'Total: {total} conversions')
