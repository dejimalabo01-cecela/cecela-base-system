import win32com.client, pythoncom

pythoncom.CoInitialize()
xl = win32com.client.Dispatch("Excel.Application")
xl.Visible = False
xl.AutomationSecurity = 1

SRC = r"C:\Users\endle\OneDrive\デスクトップ\cecela-base-system-pj\cecela-gantt.xlsm"
wb = xl.Workbooks.Open(SRC)
vba = wb.VBProject

print("=== VBA Components ===")
for comp in vba.VBComponents:
    lines = comp.CodeModule.CountOfLines
    print(f"  [{comp.Type}] {comp.Name}  ({lines} lines)")

print("\n=== CalendarForm controls ===")
try:
    form = vba.VBComponents("CalendarForm")
    designer = form.Designer
    for ctrl in designer.Controls:
        print(f"  Name={ctrl.Name!r:20s}  Type={ctrl.ControlTipText!r}")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n=== ★テンプレート★ sheet code ===")
try:
    for i in range(1, wb.Sheets.Count + 1):
        sh = wb.Sheets(i)
        if sh.Name not in ("物件一覧", "使い方"):
            comp = vba.VBComponents(sh.CodeName)
            n = comp.CodeModule.CountOfLines
            print(f"  Sheet '{sh.Name}' CodeName={sh.CodeName}  lines={n}")
            if n > 0:
                print(comp.CodeModule.Lines(1, n))
except Exception as e:
    print(f"  ERROR: {e}")

wb.Close(False)
xl.Quit()
pythoncom.CoUninitialize()
