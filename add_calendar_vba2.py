"""
修正版: Me.Controls() 参照・エラー表示・テストマクロを追加
"""
import win32com.client, pythoncom, os

def rgb(r, g, b):
    return r | (g << 8) | (b << 16)

# ── CalendarModule ────────────────────────────────────────────
MODULE_CODE = '''\
Dim g_TargetCell As Range

Sub TestCalendar()
    CalendarForm.SetMonth Year(Date), Month(Date)
    CalendarForm.Show
End Sub

Sub ShowCalendar(cell As Range)
    Set g_TargetCell = cell
    Dim yr As Integer, mo As Integer
    On Error Resume Next
    If CDbl(cell.Value) > 0 Then
        yr = Year(cell.Value): mo = Month(cell.Value)
    Else
        yr = Year(Date): mo = Month(Date)
    End If
    On Error GoTo 0
    CalendarForm.SetMonth yr, mo
    CalendarForm.Show
End Sub

Sub ApplySelectedDate(d As Date)
    If Not g_TargetCell Is Nothing Then
        Application.EnableEvents = False
        g_TargetCell.Value = d
        g_TargetCell.NumberFormat = "YYYY/MM/DD"
        Application.EnableEvents = True
    End If
End Sub
'''

# btn_click ハンドラー：Me.Controls() 方式で確実に参照
BTN_HANDLERS = "\n".join(
    f'Private Sub btn{i}_Click(): HandleDayClick Me.Controls("btn{i}"): End Sub'
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
    Dim btn As Object
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

Private Sub HandleDayClick(ctrl As Object)
    If ctrl.Caption = "" Then Exit Sub
    CalendarModule.ApplySelectedDate DateSerial(m_Year, m_Month, CInt(ctrl.Caption))
    Unload Me
End Sub

{BTN_HANDLERS}
'''

# SelectionChange イベント（エラー表示付き）
SHEET_EVENT = '''\
Private Sub Worksheet_SelectionChange(ByVal Target As Range)
    If Application.CutCopyMode <> 0 Then Exit Sub
    If Target.Count > 1 Then Exit Sub
    If (Target.Column = 2 Or Target.Column = 3) And _
       Target.Row >= 6 And Target.Row <= 14 Then
        On Error GoTo ErrHandler
        Application.EnableEvents = False
        DoEvents
        Call CalendarModule.ShowCalendar(Target)
        GoTo Done
ErrHandler:
        MsgBox "エラー: " & Err.Description & " (No." & Err.Number & ")", vbExclamation, "カレンダー"
Done:
        Application.EnableEvents = True
    End If
End Sub
'''

def add_ctrl(d, ctype, name, caption, l, t, w, h, **kw):
    c = d.Controls.Add(ctype)
    c.Name = name
    if caption is not None: c.Caption = caption
    c.Left = l; c.Top = t; c.Width = w; c.Height = h
    for k, v in kw.items(): setattr(c, k, v)
    return c

def main():
    SRC = r"C:\Users\endle\OneDrive\デスクトップ\cecela-base-system-pj\cecela-gantt.xlsx"
    DST = r"C:\Users\endle\OneDrive\デスクトップ\cecela-base-system-pj\cecela-gantt.xlsm"

    pythoncom.CoInitialize()
    xl = win32com.client.Dispatch("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    xl.AutomationSecurity = 1

    try:
        wb = xl.Workbooks.Open(SRC)
        vba = wb.VBProject

        # CalendarModule
        mod = vba.VBComponents.Add(1)
        mod.Name = "CalendarModule"
        mod.CodeModule.AddFromString(MODULE_CODE)

        # CalendarForm
        form = vba.VBComponents.Add(3)
        form.Name = "CalendarForm"
        form.Properties("Caption").Value   = "日付選択"
        form.Properties("Width").Value     = 205
        form.Properties("Height").Value    = 185
        form.Properties("BackColor").Value = rgb(255, 255, 255)

        dsgn = form.Designer
        CW, CH, LM = 27, 16, 5

        # ナビゲーション
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnPrev", "＜",
                 LM, 5, 20, 15,
                 BackColor=rgb(30,64,175), ForeColor=rgb(255,255,255))
        lbl = add_ctrl(dsgn, "Forms.Label.1", "lblMonthYear", "2026年4月",
                       28, 6, 140, 13,
                       BackColor=rgb(255,255,255), ForeColor=rgb(30,41,59))
        lbl.TextAlign = 2; lbl.Font.Bold = True; lbl.Font.Size = 10
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnNext", "＞",
                 170, 5, 20, 15,
                 BackColor=rgb(30,64,175), ForeColor=rgb(255,255,255))

        # 曜日ヘッダー
        DN   = ["月","火","水","木","金","土","日"]
        DBGS = [rgb(241,245,249)]*5 + [rgb(254,243,199)]*2
        DFGS = [rgb(51,65,85)]*5    + [rgb(146,64,14)]*2
        for i, (dn, bg, fg) in enumerate(zip(DN, DBGS, DFGS)):
            h2 = add_ctrl(dsgn, "Forms.Label.1", f"lblDay{i}", dn,
                          LM+i*CW, 24, CW-1, 11, BackColor=bg, ForeColor=fg)
            h2.TextAlign = 2; h2.Font.Size = 7; h2.Font.Bold = True

        # 42 日ボタン
        for i in range(42):
            r, c = i // 7, i % 7
            b = add_ctrl(dsgn, "Forms.CommandButton.1", f"btn{i}", "",
                         LM+c*CW, 38+r*(CH+1), CW-1, CH,
                         BackColor=rgb(255,255,255), ForeColor=rgb(30,41,59))
            b.Font.Size = 8

        # 今日・閉じる
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnToday", "今日",
                 LM, 147, 88, 15,
                 BackColor=rgb(16,185,129), ForeColor=rgb(255,255,255))
        add_ctrl(dsgn, "Forms.CommandButton.1", "btnClose", "閉じる",
                 107, 147, 88, 15,
                 BackColor=rgb(148,163,184), ForeColor=rgb(255,255,255))

        form.Properties("Height").Value = 172
        form.CodeModule.AddFromString(FORM_CODE)

        # 各シートにイベント追加
        SKIP = {"物件一覧", "使い方"}
        for i in range(1, wb.Sheets.Count + 1):
            sh = wb.Sheets(i)
            if sh.Name not in SKIP:
                comp = vba.VBComponents(sh.CodeName)
                comp.CodeModule.AddFromString(SHEET_EVENT)

        if os.path.exists(DST):
            os.remove(DST)
        wb.SaveAs(DST, 52)
        wb.Close(False)
        print("OK:", DST)

    except Exception as e:
        print("Error:", type(e).__name__, e)
        import traceback; traceback.print_exc()
        try: wb.Close(False)
        except: pass
    finally:
        xl.Quit()
        pythoncom.CoUninitialize()

main()
