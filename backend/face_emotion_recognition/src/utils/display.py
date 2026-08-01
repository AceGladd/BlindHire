import time

import cv2
import numpy as np


def draw_alert_banner(img, text, color=(0, 0, 255), flash=True):
    """Full-width warning banner drawn at the top of the frame.
    `flash` alternates the banner's brightness based on wall-clock time
    so it's visually attention-grabbing without extra state to track."""
    h, w = img.shape[:2]
    band_h = max(40, int(h * 0.08))

    intensity = 1.0
    if flash:
        intensity = 0.55 + 0.45 * abs((time.time() * 2) % 2 - 1)
    banner_color = tuple(int(c * intensity) for c in color)

    overlay = img.copy()
    cv2.rectangle(overlay, (0, 0), (w, band_h), banner_color, -1)
    cv2.addWeighted(overlay, 0.75, img, 0.25, 0, dst=img)

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = band_h / 45.0
    thickness = max(2, band_h // 20)
    text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
    tx = max(10, (w - text_size[0]) // 2)
    ty = band_h // 2 + text_size[1] // 2
    cv2.putText(img, text, (tx, ty), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)
    return img


def draw_status_panel(img, lines, origin=(10, 30), line_height=28,
                       font_scale=0.65, color=(0, 255, 0)):
    """Draws a compact stack of status lines (label/value tuples or
    plain strings) with a semi-transparent backing box for readability."""
    x, y = origin
    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = 2

    box_w = 0
    for line in lines:
        text = line[0] if isinstance(line, tuple) else line
        (tw, _), _ = cv2.getTextSize(text, font, font_scale, thickness)
        box_w = max(box_w, tw)
    box_h = line_height * len(lines)

    overlay = img.copy()
    cv2.rectangle(overlay, (x - 8, y - 22), (x + box_w + 16, y - 22 + box_h + 10), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.45, img, 0.55, 0, dst=img)

    for i, line in enumerate(lines):
        text, line_color = (line if isinstance(line, tuple) else (line, color))
        cv2.putText(img, text, (x, y + i * line_height), font, font_scale, line_color, thickness, cv2.LINE_AA)
    return img

def display_EMO_PRED(img, box, label='', color=(128, 128, 128), txt_color=(255, 255, 255), line_width=2):
    lw = line_width or max(round(sum(img.shape) / 2 * 0.003), 2)
    text2_color = (255, 0, 255)
    p1, p2 = (int(box[0]), int(box[1])), (int(box[2]), int(box[3]))
    cv2.rectangle(img, p1, p2, text2_color, thickness=lw, lineType=cv2.LINE_AA)
    font = cv2.FONT_HERSHEY_SIMPLEX
    tf = max(lw - 1, 1)
    text_fond = (0, 0, 0)
    text_width_2, text_height_2 = cv2.getTextSize(label, font, lw / 3, tf)
    text_width_2 = text_width_2[0] + round(((p2[0] - p1[0]) * 10) / 360)
    center_face = p1[0] + round((p2[0] - p1[0]) / 2)
    cv2.putText(img, label,
                (center_face - round(text_width_2 / 2), p1[1] - round(((p2[0] - p1[0]) * 20) / 360)), font,
                lw / 3, text_fond, thickness=tf, lineType=cv2.LINE_AA)
    cv2.putText(img, label,
                (center_face - round(text_width_2 / 2), p1[1] - round(((p2[0] - p1[0]) * 20) / 360)), font,
                lw / 3, text2_color, thickness=tf, lineType=cv2.LINE_AA)
    return img

def display_FPS(img, text, margin=1.0, box_scale=1.0):
    img_h, img_w, _ = img.shape
    line_width = int(min(img_h, img_w) * 0.001)  # line width
    thickness = max(int(line_width / 3), 1)  # font thickness
    font_face = cv2.FONT_HERSHEY_SIMPLEX
    font_color = (0, 0, 0)
    font_scale = thickness / 1.5
    t_w, t_h = cv2.getTextSize(text, font_face, font_scale, None)[0]
    margin_n = int(t_h * margin)
    sub_img = img[0 + margin_n: 0 + margin_n + t_h + int(2 * t_h * box_scale),
              img_w - t_w - margin_n - int(2 * t_h * box_scale): img_w - margin_n]
    white_rect = np.ones(sub_img.shape, dtype=np.uint8) * 255
    img[0 + margin_n: 0 + margin_n + t_h + int(2 * t_h * box_scale),
    img_w - t_w - margin_n - int(2 * t_h * box_scale):img_w - margin_n] = cv2.addWeighted(sub_img, 0.5, white_rect, .5, 1.0)
    cv2.putText(img=img, text=text, org=(img_w - t_w - margin_n - int(2 * t_h * box_scale) // 2, 0 + margin_n + t_h + int(2 * t_h * box_scale) // 2), fontFace=font_face, fontScale=font_scale, color=font_color, thickness=thickness, lineType=cv2.LINE_AA, bottomLeftOrigin=False)
    return img
