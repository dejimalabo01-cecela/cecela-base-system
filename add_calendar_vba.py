"""
cecela-gantt.xlsx に VBA カレンダーピッカーを追加して .xlsm で保存する
"""

import win32com.client
import pythoncom
import os

def rgb(r, g, b):
    return r | (g << 8) | (b << 16)

# ── VBA モジュールコード ──────────────────────────────────────────
MODULE_CODE = '''\
Dim g_TargetCell As Range

Sub ShowCalendar(cell As Range)
    Set g_TargetCell = cell
    Dim yr As Integer, mo As Integer
    If CDbl(cell.Value) > 0 Then
        yr = Year(cell.Value)
        mo = Month(cell.Value)
    Else
        yr = Year(Date)
        mo = Month(Date)
    End If
    CalendarForm.SetMonth yr, mo
    CalendarForm.Show
End Sub

Sub ApplySelectedDate(selectedDate As Date)
    If Not g_TargetCell Is Nothing Then
        Application.EnableEvents = False
        g_TargetCell.Value = selectedDate
        g_TargetCell.NumberFormat = "YYYY/MM/DD"
        Application.EnableEvents = True
    End If
End Sub
'''

# 42 個の日ボタンハンドラー（自動生成）
BTN_HANDLERS = "\n".join(
    f"Private Sub btn{i}_Click(): HandleDayClick btn{i}: End Sub"
    for i in range(42)
)

FORM_CODE = f'''\
Private m_Year As Integer
Private m_Month As Integer

Public Sub SetMonth(yr As Integer, mo As Integer)
    m_Year = yr
    m_Month = mo
    RefreshCalendar
End Sub

Private Sub RefreshCalendar()
    Dim mn(1 To 12) As String
    mn(1)="1月":mn(2)="2月":mn(3)="3月":mn(4)="4月"
    mn(5)="5月":mn(6)="6月":mn(7)="7月":mn(8)="8月"
    mn(9)="9月":mn(10)="10月":mn(11)="11月":mn(12)="12月"
    lblMonthYear.Caption = m_Year & "年 " & mn(m_Month)

    Dim firstDay As Date
    firstDay = DateSerial(m_Year, m_Month, 1)
    Dim startOff As Integer
    startOff = (Weekday(firstDay, vbSunday) + 5) Mod 7
    Dim daysInMo As Integer
    daysInMo = Day(DateSerial(m_Year, m_Month + 1, 0))

    Dim i As Integer, d As Integer, isWknd As Boolean
    Dim btn As MSForms.CommandButton
    Dim td As Date
    d = 1
    For i = 0 To 41
        Set btn = Me.Controls("btn" & i)
        isWknd = (i Mod 7 = 5 Or i Mod 7 = 6)
        If i < startOff Or d > daysInMo Then
            btn.Caption = ""
            btn.Enabled = False
            btn.BackColor = RGB(248, 250, 252)
            btn.ForeColor = RGB(200, 200, 200)
        Else
            btn.Caption = CStr(d)
            btn.Enabled = True
            td = DateSerial(m_Year, m_Month, d)
            If td = Date Then
                btn.BackColor = RGB(30, 64, 175)
                btn.ForeColor = RGB(255, 255, 255)
                btn.Font.Bold = True
            ElseIf isWknd Then
                btn.BackColor = RGB(255, 247, 230)
                btn.ForeColor = RGB(146, 64, 14)
                btn.Font.Bold = False
            Else
                btn.BackColor = RGB(255, 255, 255)
                btn.ForeColor = RGB(30, 41, 59)
                btn.Font.Bold = False
            End If
            d = d + 1
        End If
    Next i
End Sub

Private Sub btnPrev_Click()
    m_Month = m_Month - 1
    If m_Month < 1 Then
        m_Month = 12
        m_Year = m_Year - 1
    End If
    RefreshCalendar
End Sub

Private Sub btnNext_Click()
    m_Month = m_Month + 1
    If m_Month > 12 Then
        m_Month = 1
        m_Year = m_Year + 1
    End If
    RefreshCalendar
End Sub

Private Sub btnToday_Click()
    CalendarModule.ApplySelectedDate Date
    Unload Me
End Sub

Private Sub btnClose_Click()
    Unload Me
End Sub

Private Sub HandleDayClick(ctrl As MSForms.CommandButton)
    If ctrl.Caption = "" Then Exit Sub
    Dim d As Integer
    d = CInt(ctrl.Caption)
    CalendarModule.ApplySelectedDate DateSerial(m_Year, m_Month, d)
    Unload Me
End Sub

{BTN_HANDLERS}
'''

# シートイベントコード（日付セルクリック時にカレンダー表示）
SHEET_EVENT = '''\
Private Sub Worksheet_SelectionChange(ByVal Target As Range)
    If Application.CutCopyMode <> 0 Then Exit Sub
    If Target.Count > 1 Then Exit Sub
    If (Target.Column = 2 Or Target.Column = 3) And _
       Target.Row >= 6 And Target.Row <= 14 Then
        Application.EnableEvents = False
        Call CalendarModule.ShowCalendar(Target)
        Application.EnableEvents = True
    End If
End Sub
'''

def add_ctrl(designer, ctype, name, caption, left, top, w, h, **kwargs):
    ctrl = designer.Controls.Add(ctype)
    ctrl.Name = name
    if caption is not None:
        ctrl.Caption = caption
    ctrl.Left = left; ctrl.Top = top
    ctrl.Width = w;   ctrl.Height = h
    for k, v in kwargs.items():
        setattr(ctrl, k, v)
    return ctrl

def main():
    SRC = r"C:\Users\endle\OneDrive\デスクトップ\cecela-base-system-pj\cecela-gantt.xlsx"
    DST = r"C:\Users\endle\OneDrive\デスクトップ\cecela-base-system-pj\cecela-gantt.xlsm"

    pythoncom.CoInitialize()
    xl = win32com.client.Dispatch("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    xl.AutomationSecurity = 1  # msoAutomationSecurityLow

    try:
        wb = xl.Workbooks.Open(SRC)

        try:
            vba = wb.VBProject
        except Exception:
            print("ERROR: Excelの「ファイル」→「オプション」→「セキュリティセンター」")
            print("→「セキュリティセンターの設定」→「マクロの設定」")
            print("→「VBAプロジェクトオブジェクトモデルへのアクセスを信頼する」にチェック")
            return

        # ── CalendarModule ────────────────────────────────────────
        mod = vba.VBComponents.Add(1)       # vbext_ct_StdModule
        mod.Name = "CalendarModule"
        mod.CodeModule.AddFromString(MODULE_CODE)

        # ── CalendarForm (UserForm) ───────────────────────────────
        form = vba.VBComponents.Add(3)      # vbext_ct_MSForm
        form.Name = "CalendarForm"
        form.Properties("Caption").Value  = "日付選択カレンダー"
        form.Properties("Width").Value    = 205
        form.Properties("Height").Value   = 185
        form.Properties("BackColor").Value = rgb(255, 255, 255)

        dsgn = form.Designer
        CW, CH, LM = 27, 16, 5             # cell width, height, left-margin

        # ナビゲーション行
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnPrev", "＜",
                 LM, 5, 20, 15,
                 BackColor=rgb(30,64,175), ForeColor=rgb(255,255,255))
        lbl = add_ctrl(dsgn, "Forms.Label.1", "lblMonthYear", "2026年4月",
                       28, 6, 140, 13,
                       BackColor=rgb(255,255,255), ForeColor=rgb(30,41,59))
        lbl.TextAlign = 2
        lbl.Font.Bold = True; lbl.Font.Size = 10
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnNext", "＞",
                 170, 5, 20, 15,
                 BackColor=rgb(30,64,175), ForeColor=rgb(255,255,255))

        # 曜日ヘッダー
        DAY_NAMES = ["月","火","水","木","金","土","日"]
        DAY_BG  = [rgb(241,245,249)]*5 + [rgb(254,243,199)]*2
        DAY_FG  = [rgb(51,65,85)]*5    + [rgb(146,64,14)]*2
        for i, (dn, bg, fg) in enumerate(zip(DAY_NAMES, DAY_BG, DAY_FG)):
            h2 = add_ctrl(dsgn, "Forms.Label.1", f"lblDay{i}", dn,
                          LM + i*CW, 24, CW-1, 11,
                          BackColor=bg, ForeColor=fg)
            h2.TextAlign = 2; h2.Font.Size = 7; h2.Font.Bold = True

        # 日付ボタン 42 個
        for i in range(42):
            r, c = i // 7, i % 7
            b = add_ctrl(dsgn, "Forms.CommandButton.1", f"btn{i}", "",
                         LM + c*CW, 38 + r*(CH+1), CW-1, CH,
                         BackColor=rgb(255,255,255), ForeColor=rgb(30,41,59))
            b.Font.Size = 8

        # 下部ボタン  (最終行 bottom ≈ 38+5*17+4 = 38+89 = 127+16=143)
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnToday", "今日",
                 LM, 147, 88, 15,
                 BackColor=rgb(16,185,129), ForeColor=rgb(255,255,255))
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnClose", "閉じる",
                 107, 147, 88, 15,
                 BackColor=rgb(148,163,184), ForeColor=rgb(255,255,255))

        # フォームコード追加
        form.CodeModule.AddFromString(FORM_CODE)

        # ── 各シートにイベント追加 ─────────────────────────────────
        SKIP = {"物件一覧", "使い方"}
        for i in range(1, wb.Sheets.Count + 1):
            sh = wb.Sheets(i)
            if sh.Name not in SKIP:
                comp = vba.VBComponents(sh.CodeName)
                comp.CodeModule.AddFromString(SHEET_EVENT)

        # ── .xlsm として保存 ────────────────────────────────────────
        if os.path.exists(DST):
            os.remove(DST)
        wb.SaveAs(DST, 52)   # 52 = xlOpenXMLWorkbookMacroEnabled
        wb.Close(False)
        print("OK:", DST)

    except Exception as e:
        print("Error:", type(e).__name__, e)
        try: wb.Close(False)
        except: pass
    finally:
        xl.Quit()
        pythoncom.CoUninitialize()

main()
